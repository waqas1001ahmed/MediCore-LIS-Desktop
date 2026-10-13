import { getMongoClient, getMongoDatabase, closeMongo } from './mongodb.js';

function timeValue(value) {
  const text = String(value || '');
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  return Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
}

function nearestOrder(value, orders) {
  const exact = orders.filter((order) => String(order.created_at) === String(value));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`Ambiguous exact created_at match: ${value}`);

  const target = timeValue(value);
  const ranked = orders
    .map((order) => ({ order, distance: Math.abs(timeValue(order.created_at) - target) }))
    .sort((left, right) => left.distance - right.distance);
  if (!ranked.length || !Number.isFinite(ranked[0].distance) || ranked[0].distance > 2000) {
    throw new Error(`No order within two seconds of child record created_at ${value}`);
  }
  if (ranked[1]?.distance === ranked[0].distance) {
    throw new Error(`Ambiguous nearest order for child record created_at ${value}`);
  }
  return ranked[0].order;
}

async function main() {
  const database = await getMongoDatabase();
  const orders = database.collection('orders');
  const duplicateGroups = await orders.aggregate([
    {
      $group: {
        _id: '$id',
        count: { $sum: 1 },
        orders: { $push: { mongoId: '$_id', id: '$id', patient_id: '$patient_id', order_no: '$order_no', created_at: '$created_at' } },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  const highestOrder = await orders.find({}).sort({ id: -1 }).limit(1).next();
  const sequence = await database.collection('sequences').findOne({ name: 'id:orders', period: '' });
  let nextId = Math.max(Number(highestOrder?.id || 0), Number(sequence?.value || 0));
  const parentUpdates = [];
  const childUpdates = [];

  for (const group of duplicateGroups) {
    const parents = group.orders.sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
    const patientIds = parents.map((order) => String(order.patient_id));
    if (new Set(patientIds).size !== patientIds.length) {
      throw new Error(`Order ID ${group._id} has multiple orders for the same patient; refusing ambiguous repair.`);
    }

    const assignedIds = new Map([[String(parents[0].mongoId), Number(group._id)]]);
    for (const parent of parents.slice(1)) {
      nextId += 1;
      assignedIds.set(String(parent.mongoId), nextId);
      parentUpdates.push({ mongoId: parent.mongoId, oldId: Number(group._id), newId: nextId, patientId: parent.patient_id, orderNo: parent.order_no });
    }

    const items = await database.collection('order_items').find({ order_id: group._id }).toArray();
    for (const item of items) {
      const parent = nearestOrder(item.created_at, parents);
      const newOrderId = assignedIds.get(String(parent.mongoId));
      if (newOrderId !== Number(group._id)) childUpdates.push({ collection: 'order_items', mongoId: item._id, oldOrderId: Number(group._id), newOrderId });
    }

    for (const collectionName of ['reports', 'receipts', 'payments']) {
      const children = await database.collection(collectionName).find({ order_id: group._id }).toArray();
      for (const child of children) {
        const matches = parents.filter((order) => String(order.patient_id) === String(child.patient_id));
        if (matches.length !== 1) {
          throw new Error(`Cannot uniquely map ${collectionName} record ${child._id} to order ID ${group._id}.`);
        }
        const newOrderId = assignedIds.get(String(matches[0].mongoId));
        if (newOrderId !== Number(group._id)) childUpdates.push({ collection: collectionName, mongoId: child._id, oldOrderId: Number(group._id), newOrderId });
      }
    }
  }

  const plan = { duplicateGroups: duplicateGroups.length, parentUpdates, childUpdates, resultingOrderSequence: nextId };
  console.log(JSON.stringify(plan, null, 2));
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Re-run with --apply to update MongoDB.');
    return;
  }
  if (!duplicateGroups.length) {
    await orders.createIndex({ id: 1 }, { unique: true, name: 'orders_app_id_unique' });
    console.log('No duplicate order IDs found; unique index is in place.');
    return;
  }

  const client = getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const update of parentUpdates) {
        const result = await orders.updateOne(
          { _id: update.mongoId, id: update.oldId },
          { $set: { id: update.newId } },
          { session },
        );
        if (result.matchedCount !== 1) throw new Error(`Order ${update.orderNo} changed during repair.`);
      }
      for (const update of childUpdates) {
        const result = await database.collection(update.collection).updateOne(
          { _id: update.mongoId, order_id: update.oldOrderId },
          { $set: { order_id: update.newOrderId } },
          { session },
        );
        if (result.matchedCount !== 1) throw new Error(`${update.collection} record ${update.mongoId} changed during repair.`);
      }
      await database.collection('sequences').updateOne(
        { name: 'id:orders', period: '' },
        { $max: { value: nextId } },
        { upsert: true, session },
      );
    });
  } finally {
    await session.endSession();
  }

  await orders.createIndex({ id: 1 }, { unique: true, name: 'orders_app_id_unique' });
  console.log('Order ID collision repair committed; unique application-ID index created.');
}

main()
  .catch((error) => {
    console.error(`ORDER_ID_REPAIR_FAILED: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closeMongo);
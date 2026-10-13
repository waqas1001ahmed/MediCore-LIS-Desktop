# Deploying the backend to Vercel

1. Create a Vercel project from the repository and set its Root Directory to `backend`.
2. Configure these Production environment variables in Vercel:
   - `MONGODB_URI`: MongoDB connection string, with Atlas network access configured for Vercel.
   - `MONGODB_DATABASE`: database name, usually `MediCoreLIS`.
   - `JWT_SECRET`: a long, random secret; do not use the development fallback.
   - `CORS_ORIGIN`: the deployed frontend origin, without a trailing slash. Separate multiple origins with commas.
3. Create a Vercel Blob store for the project and make its `BLOB_READ_WRITE_TOKEN` available to the deployment. Logo uploads use Blob on Vercel and local disk during development.
4. Deploy. The API remains under `/api`, so verify the deployment at `/api/health`.

Vercel detects the Express app exported by `src/app.js`; the local `npm run dev` and `npm start` commands continue to use `src/index.js`.

Files written to `uploads/` on a local machine are not deployed or persistent on Vercel. Re-upload any existing laboratory logo after deployment so its saved URL points to Blob storage.
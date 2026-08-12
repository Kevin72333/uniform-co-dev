# Renderer worker

`renderer-worker.mjs` is a protected job runner for the PDF and ERP artifact RPCs. It must run outside the browser with a database connection whose **same login role** is `job_document_renderer` or `job_erp_renderer`, plus a matching `private.job_actor_bindings` row. It never uses the Supabase service key for database calls.

The renderer adapter is injected through `RENDER_COMMAND`; the command receives `--attempt-id`, `--payload` (a versioned `uniform-document-render-payload-v1` or `uniform-erp-render-payload-v1` JSON DTO), and `--output`, and must write the final PDF or ERP payload to that path. The runner hashes the bytes, uploads the attempt-reserved key to the private bucket, and calls the lease-fenced finalize RPC. A failure creates a retry attempt; an expired lease cannot finalize.

Required protected environment: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_STORAGE_ADMIN_KEY`, `RENDER_COMMAND`, and optional `RENDER_KIND=PDF|ERP`, `RENDER_OUTPUT_PATH`, `RENDER_LEASE_SECONDS`. Keep this process on a private worker network; never expose these secrets to Vercel/browser code.

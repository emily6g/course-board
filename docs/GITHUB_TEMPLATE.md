# Publish Course Board as a GitHub template

1. Merge the completed product branch into `main`.
2. In GitHub repository settings, enable **Template repository**.
3. Keep `.env`, `.dev.vars`, Canvas feed URLs, database IDs for private projects,
   and any student-specific syllabus files out of commits.
4. Keep `wrangler.example.jsonc` in the template and keep active `wrangler.jsonc`
   files ignored.

The template is intentionally single-user-per-deployment. Anyone can create a
new repository from the template and connect their own D1 database, private R2
bucket, and optional Canvas calendar without sharing data with another deployment.

# Publish Course Board as a GitHub template

1. Create a public repository named `course-board` or another name you prefer.
2. Push this folder to the repository.
3. In GitHub repository settings, enable **Template repository**.
4. Keep `.env`, `.dev.vars`, Canvas feed URLs, database IDs for private projects,
   and any student-specific syllabus files out of commits.
5. Replace the sample semester in `data/coursework.ts` before deploying a
   personal copy.

The template is intentionally single-user-per-deployment. Anyone can create a
new repository from the template and connect their own D1 database and Canvas
calendar without sharing data with another deployment.

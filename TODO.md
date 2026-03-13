# Fix Resume Name Detection

## Steps:
- [x] 1. Edit backend/routes/resume.js: Add local name/email/phone extraction regex before AI call. Update AI prompt to require these fields. Enhance local fallback.
- [x] 2. Edit frontend/resume/src/pages/Dashboard.jsx: Improve parseResumeData to prioritize backend-extracted fields, better fallback display.
- [ ] 3. Test endpoint: Run backend if not active, test /api/resume/analyze with sample upload.
- [ ] 4. Verify frontend display and complete.

Current: Fixed backend syntax errors. Backend should restart via nodemon. Test upload in frontend Dashboard. Step 3/4 verification.

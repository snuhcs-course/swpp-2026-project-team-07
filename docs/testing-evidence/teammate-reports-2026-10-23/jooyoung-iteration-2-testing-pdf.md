### Manual test write-up: malformed PDF upload

**Tester:** Jooyoung
**Test date:** October 23, 2026  
**Device:** Galaxy Tab S7 FE
**App version:** PR #31 
**Evidence:** Docker API log supplied by tester; video screenrecording 

**Steps**

1. Open the app on the tablet.
2. Upload the PDF identified as malformed.
3. Observe the app around 07:14.
4. Retry or observe the upload response.

**Expected behavior**

The PDF should either upload successfully or be rejected with a clear, controlled validation message. The rest of the app should remain responsive.

**Actual behavior**

The upload reached the backend but failed twice, at approximately 07:14:27 and 07:14:40 in the supplied log.

The request path was:

```text
POST /api/decks/
```

The backend failed while saving extracted slide text. PostgreSQL/psycopg raised:

```text
UnicodeEncodeError: 'utf-8' codec can't encode characters
surrogates not allowed
```

Django then raised the same encoding error while trying to render the error page. Both upload attempts returned HTTP 500.

**Result:** Failed

That strengthens the incident report. Use this revised section:

### Impact observed by tester

The tester reported that the app became laggy after the malformed PDF upload, including while opening and navigating through a different valid PDF.

Observed behavior included:

- The malformed PDF’s uploading slide glitched on screen.
- After recording on the malformed PDF, the transcript page displayed **“Couldn’t upload this take.”**
- On a valid PDF, pressing **Rerecord** played audio instead of starting the expected rerecord flow.
- Buttons and swipe-back navigation became unresponsive while Docker was logging `UnicodeEncodeError`.

The supplied log confirms repeated backend failures during malformed-PDF upload. It does not independently prove that the upload caused every subsequent lag or UI symptom, but the timing supports recording them as related observations requiring investigation.


**Bug summary**

Malformed PDF text is not handled safely. The backend should sanitize invalid characters or return a controlled upload error instead of crashing during database insertion and error-page rendering.
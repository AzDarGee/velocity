# Custom Instructions

- Anytime a media asset is either uploaded or generated, save the raw file/binary to Firebase Cloud Storage, and only store the metadata/download URL in Firestore. Never store full base64 image strings or large binaries as document fields in Firestore to avoid exceeding the 1MB limits.

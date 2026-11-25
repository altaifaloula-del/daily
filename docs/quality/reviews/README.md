# سجلات مراجعة التصميم المستقلة

ملف لكل فرع: `<branch>.json` — يكتبه المنسق ناقلًا حكم `design-quality-auditor` حرفيًا، وتقرؤه بوابة الجودة عند وجود تغييرات واجهة.

```json
{ "commit": "<SHA آخر التزام>", "by": "design-quality-auditor", "author": "<الوكيل المنفذ>", "date": "YYYY-MM-DD",
  "verdict": "PASS | FAIL", "issues": [], "evidence": ["مسارات اللقطات قبل/بعد"] }
```

سجل لالتزام أقدم لا يُقبل. المراجع لا يكون المنفذ.

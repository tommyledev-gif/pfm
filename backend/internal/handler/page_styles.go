package handler

// pageHead is the shared <head> of the pages the backend serves itself
// (/activate, /approve-access): the app's dark palette, one card, labelled
// fields that turn red with their message underneath when invalid.
// Callers append "<title>…</title></head>".
const pageHead = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #050B14;
    color: #F5F6F8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 400px;
    background: #12161F;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px 24px;
  }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p.sub { margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.45; }
  .field { margin-top: 16px; }
  label { display: block; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.65); margin-bottom: 6px; }
  label .optional { font-weight: 400; color: rgba(255,255,255,0.4); }
  input {
    width: 100%;
    height: 52px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 0 14px;
    color: #F5F6F8;
    font-size: 16px;
  }
  input:focus { outline: none; border-color: #85FF33; }
  .field.invalid input { border-color: #FF9E96; background: rgba(255,158,150,0.06); }
  .hint { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.45); }
  .error { margin-top: 6px; font-size: 13px; color: #FF9E96; display: none; }
  .field.invalid .error { display: block; }
  .field.invalid .hint { display: none; }
  button {
    width: 100%;
    height: 52px;
    margin-top: 24px;
    border: none;
    border-radius: 14px;
    background: #85FF33;
    color: #06130A;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 12px; font-size: 14px; line-height: 1.45; display: none; }
  .msg.error { display: block; background: rgba(255,158,150,0.12); border: 1px solid rgba(255,158,150,0.35); color: #FF9E96; }
  .msg.success { display: block; background: rgba(126,235,192,0.12); border: 1px solid rgba(126,235,192,0.35); color: #7EEBC0; }
  .done .hide-when-done { display: none; }
</style>
`

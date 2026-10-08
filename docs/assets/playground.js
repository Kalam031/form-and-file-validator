(function () {
  var sel = document.getElementById('lang'), result = document.getElementById('result');
  FVLocales.list().forEach(function (l) { var o = document.createElement('option'); o.value = l.code; o.textContent = l.name + ' (' + l.code + ')'; sel.appendChild(o); });
  var form = FormValidator.init({
    form: '#demo-form',
    rules: { email: ['required', 'email'], name: ['required', { type: 'rangelength', min: 3, max: 20 }], pw: ['required', { type: 'minlength', min: 8 }], pw2: ['required', { type: 'equalTo', field: 'pw' }] },
    config: {
      onError: function (errors) { show({ formValid: false, errors: errors.map(function (x) { return x.name + ': ' + x.message; }) }); },
      submitHandler: function () { show({ formValid: true, note: 'Nothing is sent anywhere: this is a demo.' }); }
    }
  });
  var zone = FileValidator.widget('#zone', { allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'], maxFileSizeMB: 1, maxFiles: 3 }, {
    input: '#files', list: '#list', messageElement: '#messages', statusElement: '#status', preview: true, paste: 'document',
    onChange: function (files) { show({ selected: files.map(function (f) { return f.name + ' (' + FileValidator.formatBytes(f.size) + ')'; }) }); },
    onReject: function (rejected) { show({ rejected: rejected.map(function (r) { return { file: r.file.name, reasons: r.errors }; }) }); }
  });
  function show(o) { result.textContent = JSON.stringify(o, null, 2); }
  sel.addEventListener('change', function () {
    FVLocales.use(sel.value, { document: true });
    zone.clear(); form.clearErrors();
    show({ language: sel.value, note: 'Submit the form or add a file to see the messages in this language.' });
  });
  var auto = FVLocales.auto('en', { document: true }); sel.value = auto.code;
  var src = document.getElementById('rules-json'), fmt = document.getElementById('export-format'), out = document.getElementById('export-out');
  function exportNow() {
    try { out.textContent = FVCodegen.exportRules(JSON.parse(src.value), fmt.value, { FormValidator: FormValidator, name: 'signup' }); out.classList.remove('error'); }
    catch (e) { out.textContent = e.message; out.classList.add('error'); }
  }
  src.addEventListener('input', exportNow); fmt.addEventListener('change', exportNow); exportNow();
  document.getElementById('export-copy').addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(out.textContent); });
})();
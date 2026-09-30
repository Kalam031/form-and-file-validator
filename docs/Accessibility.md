# Accessibility review

This page says what was checked, what the libraries do for assistive technology, what you must still do in your own markup and CSS, and how to test with a real screen reader.

**Honest scope.** The automated part below runs in every `npm test`. A real screen reader was not run for this review, because that needs a person with NVDA, JAWS, VoiceOver or TalkBack. The manual script at the end is written so that someone can do it in about 20 minutes and report back.

## 1. What is tested automatically

`tests/a11y.test.js` runs [axe-core](https://github.com/dequelabs/axe-core) (the engine behind most accessibility checkers) on:

- a form with seven field types (text, email, password, select, radio group, checkbox, file), before validation, with every field in error, and after every error is fixed;
- error messages rendered as `<label>` elements, with `data-msg-*` text;
- a field while a server (`remote`) check runs (`aria-busy`);
- the jQuery compatibility layer, including `groups`;
- the upload widget: empty, with files, previews and a rejection message, and with a keyboard-operable dropzone.

All of these pass with no violations. The audit found and fixed two real problems:

| Problem found | Fix |
| --- | --- |
| `role="alert"` on a `<label>` error element is not allowed by ARIA. This affected `errorElement: 'label'` and the whole jQuery compatibility layer. | Label errors now use `aria-live="polite"` instead. Other elements keep `role="alert"`. The field's `aria-describedby` makes a screen reader read the message when the field gets focus in both cases. |
| The dropzone got `role="button"` even when it held a visible file input, which nests interactive controls (axe "serious"). | The zone only becomes a button when the real input cannot be reached by keyboard (hidden, `aria-hidden`, `tabindex="-1"`) and the zone holds no other buttons. `keyboard: true / false` overrides it. |

Two more improvements came from walking through the widget as a keyboard and screen reader user:

- After removing a file, keyboard focus used to be lost (the button that had focus disappeared). Focus now moves to the next remove button, the previous one, or the file input.
- Adding files gave a screen reader user no feedback. The `statusElement` option now announces "2 files added. 1 file not accepted. 3 selected." in a polite live region.

**What axe cannot check:** colour contrast in jsdom (the libraries add no CSS, so contrast is yours), how a message actually sounds, whether the order of announcements is sensible, and touch-target size. Those are in the manual script.

## 2. What the libraries do

**FormValidator (and the jQuery layer)**

| Behaviour | Detail |
| --- | --- |
| Invalid field | `aria-invalid="true"`, and the message's id is added to `aria-describedby` (existing `aria-describedby` values are kept). Both are removed when the field is fixed. |
| Message element | `role="alert"` on `div`/`span` messages, `aria-live="polite"` on `<label>` messages. Text is inserted as text, never as HTML. |
| Label link | A `<label>` message gets `for="<field id>"`. |
| After a failed submit | Focus moves to the first invalid field in page order, so the screen reader reads its label and then the message. `focusInvalid: false` turns it off. |
| Server check | `aria-busy="true"` and the `fv-pending` class while it runs. |
| Groups (jQuery `groups`) | Only the first message of a group is visible; the others get `hidden`, so they are not announced twice. |
| Hidden or disabled fields | Skipped, and their old messages are removed, so nothing stale is left for a screen reader. |
| Browser pop-ups | `novalidate` is set so the browser's own bubbles do not fight with the messages (restored on `destroy()`). |

**FileValidator upload widget**

| Behaviour | Detail |
| --- | --- |
| Rejected files | Listed in `messageElement`, which gets `role="alert"` and `aria-live="polite"`. One line per message, each starting with the file name. |
| Status | `statusElement` gets `role="status"` and announces added, not accepted, removed, and how many are selected. |
| File list | A list of items. Each remove button has `aria-label="Remove <file name>"`. Preview images are decorative (`alt=""`) because the name is beside them. |
| Focus | After removing a file, focus stays inside the widget (see above). |
| Dropzone | Drag and drop is a convenience only. The file input stays the accessible way to add files, and paste is optional. |

## 3. What you still have to do

- **Use real labels.** Every field needs a `<label for>` or an `aria-label`. axe reports fields without one.
- **Colour contrast.** Style `.error`, `.is-invalid` and the widget classes yourself, at least 4.5:1 for the message text (3:1 for borders), and do not rely on red alone. The message text itself already carries the meaning.
- **Do not hide the input completely.** If you visually hide the file input, keep it focusable (a visually-hidden style, not `display:none`), or let the widget make the zone the control (`keyboard`).
- **Keep the file list outside a clickable zone.** A list with remove buttons inside a `role="button"` zone nests interactive controls.
- **Provide the live regions.** Add empty `#messages` and `#status` elements to the page from the start. Live regions that are created at the same moment as their text are announced unreliably by some screen readers.
- **Many errors at once.** Each `role="alert"` message can be announced. If that is too noisy for a long form, move focus to a summary in `onError` and set `errorElement` to a `label` (polite).

## 4. Manual screen reader test script

Do this once per release with at least two of: NVDA + Firefox (Windows), JAWS + Chrome (Windows), VoiceOver + Safari (macOS), VoiceOver + Safari (iOS), TalkBack + Chrome (Android). Use `demo.html` and `demo-upload.html`. Write down what is announced, and mark anything different from "expected".

**A. Form errors (`demo.html`)**

| Step | Expected |
| --- | --- |
| 1. Tab through the form without typing. | Each field announces its label and type. Nothing about errors yet. |
| 2. Press the submit button with empty fields. | Focus moves to the first invalid field. The screen reader announces its label, "invalid" (or "invalid entry"), and the message ("This field is required."). |
| 3. Press Tab to the next invalid field. | Label, invalid, message. |
| 4. Type a valid value, then Tab away. | No error is announced for that field, and it is no longer reported as invalid. |
| 5. Radio group: submit without choosing. | The group's message is read with the group (fieldset legend) when its first radio is focused. |
| 6. Type text in an email field, leave it. | The error appears; when you come back to the field it reads the message. |
| 7. Browse mode / virtual cursor: read the page. | The messages are read in order, next to their fields, not at the end of the page. |

**B. Upload widget (`demo-upload.html`)**

| Step | Expected |
| --- | --- |
| 1. Tab to the file input or dropzone. | It announces as a button or file input with a clear name ("Choose files"). |
| 2. Press Enter/Space, pick one valid and one invalid file. | The status line announces "1 file added. 1 file not accepted. 1 selected." and the rejection message names the file and the reason. |
| 3. Tab to the file list. | Each item announces its file name and size; the remove button announces "Remove <name>, button". |
| 4. Press the remove button. | The status line announces "<name> removed. N selected." and focus lands on the next remove button (or the input). Focus must never fall back to the top of the page. |
| 5. Paste an image (Ctrl+V) with paste enabled. | The status line announces the added file. |

**C. Pass criteria:** no unlabeled control, every error announced once, focus never lost, no announcement that says only "alert" without the message text, and everything usable without a mouse.

Report issues with: screen reader and version, browser and version, the step number, what was announced, and what was expected.

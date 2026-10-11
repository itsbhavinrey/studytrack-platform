/**
 * Shared study log page (web/js/study-log.mjs) - Project 6.
 *
 * Lists and adds sessions through web/js/sessions-api.mjs (the only file
 * that calls fetch). Shows the four states of each asynchronous operation:
 *   loading  - "Loading sessions..." / "Saving..." with the button disabled
 *   empty    - "No sessions logged yet."
 *   success  - the list, or "Saved session #N"
 *   failure  - a message that says what happened and what to do, plus a
 *              Try again button when a resend can succeed (network failure
 *              or a retryable answer); the typed values are kept
 *
 * Same rules as P5: one listener per action, text only via textContent,
 * no innerHTML, no browser storage, no framework.
 */

import {
  minutesToHours,
  pluralize,
  roundHours,
  validateSessionInput,
} from './calculation.mjs';
import { ApiError, NetworkError, addSession, canRetry, listSessions } from './sessions-api.mjs';

const FIELDS = [
  { key: 'minutes', inputId: 'session-minutes', errorId: 'session-minutes-error' },
  { key: 'note', inputId: 'session-note', errorId: 'session-note-error' },
];

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Form text -> the value the API documents (a number for minutes). */
function toApiInput(raw) {
  const minutes = raw.minutes.trim();
  return {
    // "45" -> 45. Anything else stays text so validation explains it.
    minutes: minutes === '' ? undefined : /^\d+$/.test(minutes) ? Number(minutes) : minutes,
    note: raw.note.trim() === '' ? undefined : raw.note,
  };
}

/** Explains a failed save in words a person can act on. */
function describeSaveFailure(err) {
  if (err instanceof NetworkError) {
    return (
      `Not saved: ${err.message} It may be stopped or restarting. ` +
      'Your entry is still in the form. When the server is running, press Try again; ' +
      'it will not create a duplicate.'
    );
  }
  if (err instanceof ApiError && err.code === 'unexpected_response') {
    return (
      `Not saved: this address has no StudyTrack API (HTTP ${err.status}). ` +
      'The shared log works when the page is opened from the StudyTrack server (npm start).'
    );
  }
  if (err instanceof ApiError && err.code === 'write_conflict') {
    return 'Not saved: the log was busy with another write several times in a row. Press Try again.';
  }
  if (err instanceof ApiError && err.code === 'validation_failed') {
    return 'Not saved: the server rejected the entry. Check the highlighted fields.';
  }
  if (err instanceof ApiError) {
    return `Not saved: the server answered HTTP ${err.status} (${err.code}): ${err.message}${err.retryable ? ' Press Try again.' : ''}`;
  }
  return `Not saved: unexpected error (${err.message}). Reload the page and save again.`;
}

function describeLoadFailure(err) {
  if (err instanceof NetworkError) {
    return `Could not load sessions: ${err.message} Start the server, then press Refresh list.`;
  }
  if (err instanceof ApiError && err.code === 'unexpected_response') {
    return (
      `Could not load sessions: this address has no StudyTrack API (HTTP ${err.status}). ` +
      'Open the page from the StudyTrack server (npm start).'
    );
  }
  return `Could not load sessions: the server answered HTTP ${err.status} (${err.code}): ${err.message}`;
}

/** One list item, built from text nodes only. */
function sessionItem(session) {
  const item = document.createElement('li');
  item.className = 'card session';
  item.dataset.id = String(session.id);

  const heading = document.createElement('p');
  heading.className = 'session-meta';
  const id = document.createElement('strong');
  id.textContent = `#${session.id}`;
  const time = document.createElement('time');
  time.dateTime = session.timestamp;
  time.textContent = TIME_FORMAT.format(new Date(session.timestamp));
  heading.append(id, ` ${pluralize(session.minutes, 'minute')} - `, time);

  const note = document.createElement('p');
  note.className = 'session-note';
  note.textContent = session.note;

  item.append(heading, note);
  return item;
}

/**
 * Wires the page. Called once at the bottom of this module.
 * The handlers are closures over the element lookups and over three pieces
 * of state: `saving` (a save is in flight), `draft` (the idempotency key for
 * the values currently being saved) and `loadNumber` (which list request is
 * the newest).
 */
export function wireStudyLog(doc) {
  const form = doc.getElementById('session-form');
  const fields = FIELDS.map(({ key, inputId, errorId }) => {
    const input = doc.getElementById(inputId);
    const hintIds = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    return { key, input, error: doc.getElementById(errorId), hintIds };
  });
  const saveButton = doc.getElementById('save-button');
  const retryButton = doc.getElementById('retry-save');
  const saveStatus = doc.getElementById('save-status');
  const refreshButton = doc.getElementById('refresh-sessions');
  const listState = doc.getElementById('sessions-state');
  const list = doc.getElementById('sessions-list');

  let saving = false;
  let draft = null; // { key, minutes, note }
  let loadNumber = 0;
  let submits = 0;

  function setFieldError(field, message) {
    field.error.textContent = message || '';
    const describedBy = message ? [field.error.id, ...field.hintIds] : field.hintIds;
    field.input.setAttribute('aria-describedby', describedBy.join(' '));
    if (message) field.input.setAttribute('aria-invalid', 'true');
    else field.input.removeAttribute('aria-invalid');
  }

  function showFieldErrors(errors) {
    for (const field of fields) setFieldError(field, errors[field.key]);
  }

  // The same values keep the same key, so "Try again" after a lost response
  // is recognised by the server. Changed values are a new entry: new key.
  function keyFor(values) {
    if (!draft || draft.minutes !== values.minutes || draft.note !== values.note) {
      draft = { key: crypto.randomUUID(), ...values };
    }
    return draft.key;
  }

  function setSaving(on) {
    saving = on;
    saveButton.disabled = on;
    saveButton.textContent = on ? 'Saving...' : 'Save session';
    form.setAttribute('aria-busy', String(on));
    if (on) retryButton.hidden = true;
  }

  async function loadSessions() {
    const mine = ++loadNumber;
    listState.textContent = 'Loading sessions...';
    list.setAttribute('aria-busy', 'true');
    refreshButton.disabled = true;
    try {
      const data = await listSessions();
      // A slower, older request must not overwrite a newer answer.
      if (mine !== loadNumber) return;
      list.replaceChildren(...data.sessions.slice().reverse().map(sessionItem));
      listState.textContent =
        data.count === 0
          ? 'No sessions logged yet. Saved sessions appear here for every tab.'
          : `${pluralize(data.count, 'session')}, ${pluralize(data.totalMinutes, 'minute')} ` +
            `(${pluralize(roundHours(minutesToHours(data.totalMinutes)), 'hour')}) in total. Newest first.`;
    } catch (err) {
      if (mine !== loadNumber) return;
      console.warn('[study-log] list failed:', err.name, err.message);
      listState.textContent =
        describeLoadFailure(err) + (list.children.length > 0 ? ' The list below may be out of date.' : '');
    } finally {
      if (mine === loadNumber) {
        list.setAttribute('aria-busy', 'false');
        refreshButton.disabled = false;
      }
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    submits += 1;
    if (saving) {
      console.info(`[study-log] submit ${submits} ignored: a save is already pending`);
      return;
    }

    const check = validateSessionInput(toApiInput({ minutes: fields[0].input.value, note: fields[1].input.value }));
    showFieldErrors(check.errors);
    if (!check.ok) {
      saveStatus.textContent = 'Not saved: check the highlighted fields.';
      fields.find((f) => check.errors[f.key]).input.focus();
      return;
    }

    const idempotencyKey = keyFor(check.values);
    setSaving(true);
    saveStatus.textContent = 'Saving...';
    console.info(`[study-log] submit ${submits}: POST /api/sessions (key ${idempotencyKey})`);
    try {
      const { session, created } = await addSession(check.values, {
        idempotencyKey,
        onRetry: (attempt) => {
          saveStatus.textContent = `The log is busy; retrying (${attempt})...`;
        },
      });
      draft = null;
      form.reset();
      showFieldErrors({});
      saveStatus.textContent = created
        ? `Saved session #${session.id}: ${pluralize(session.minutes, 'minute')}.`
        : `Already saved as session #${session.id}; no duplicate was added.`;
      setSaving(false);
      await loadSessions();
    } catch (err) {
      console.warn('[study-log] save failed:', err.name, err.message);
      if (err instanceof ApiError && err.code === 'validation_failed') showFieldErrors(err.details);
      saveStatus.textContent = describeSaveFailure(err);
      setSaving(false);
      // Only offer Try again when resending the same values can succeed:
      // after a 422 the same entry would be refused again.
      retryButton.hidden = !canRetry(err);
    }
  }

  form.addEventListener('submit', onSubmit);
  // "Try again" sends the same values (and so the same key) through the
  // normal submit path, so validation and the pending guard still apply.
  retryButton.addEventListener('click', () => form.requestSubmit());
  refreshButton.addEventListener('click', () => loadSessions());

  loadSessions();
}

wireStudyLog(document);

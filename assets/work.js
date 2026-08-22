import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

function ensureWorkLog() {
  if (document.querySelector(".work-log")) return;
  var path = window.location.pathname || "";
  var lessonMatch = path.match(/\/lessons\/([^/]+)\.html$/i);
  var onGrades = /\/grades\.html$/i.test(path);
  if (!lessonMatch && !onGrades) return;
  var host = document.querySelector(".inner") || document.querySelector("main");
  if (!host) return;
  var mid = lessonMatch ? lessonMatch[1] : "";
  var unlocked = mid === "c0-1" || onGrades;
  var section = document.createElement("section");
  section.className = "work-log" + (unlocked ? "" : " is-locked");
  section.id = "work-log";
  if (onGrades) section.setAttribute("data-work-all", "1");
  if (mid) section.setAttribute("data-lesson", mid);
  section.setAttribute("data-unlocked", unlocked ? "1" : "0");
  var h = document.createElement("h2");
  h.textContent = "Work log";
  section.appendChild(h);
  if (!onGrades) {
    var lead = document.createElement("p");
    lead.className = "work-log-lead";
    lead.textContent = "Write your answer. I grade this. Opening the page does not make you competent.";
    section.appendChild(lead);
  } else {
    var glead = document.createElement("p");
    glead.className = "lede";
    glead.textContent = "Answers you submitted from lesson pages. I grade these. A save is not a rating.";
    section.appendChild(glead);
  }
  if (!unlocked && !onGrades) {
    var lock = document.createElement("p");
    lock.className = "lock-note";
    lock.textContent = "Only C0.1 accepts work. This lesson is locked.";
    section.appendChild(lock);
  }
  var auth = document.createElement("div");
  auth.className = "work-log-auth";
  section.appendChild(auth);
  if (!onGrades) {
    var form = document.createElement("form");
    form.className = "work-log-form";
    var lab = document.createElement("label");
    lab.className = "work-log-label";
    lab.setAttribute("for", "work-body-" + mid);
    lab.textContent = "Your answer";
    var ta = document.createElement("textarea");
    ta.id = "work-body-" + mid;
    ta.name = "body";
    ta.rows = 8;
    ta.required = true;
    if (!unlocked) ta.disabled = true;
    var actions = document.createElement("p");
    actions.className = "work-log-actions";
    var btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "btn";
    btn.textContent = "Submit";
    if (!unlocked) btn.disabled = true;
    actions.appendChild(btn);
    var st = document.createElement("p");
    st.className = "work-log-status";
    st.setAttribute("role", "status");
    form.appendChild(lab);
    form.appendChild(ta);
    form.appendChild(actions);
    form.appendChild(st);
    section.appendChild(form);
  }
  var hist = document.createElement("div");
  hist.className = "work-log-history";
  var kick = document.createElement("p");
  kick.className = "kicker";
  kick.textContent = "Prior attempts";
  var ol = document.createElement("ol");
  ol.className = "work-log-list";
  hist.appendChild(kick);
  hist.appendChild(ol);
  section.appendChild(hist);
  var pager = host.querySelector(".pager");
  var foot = host.querySelector(".foot");
  if (pager) pager.parentNode.insertBefore(section, pager);
  else if (foot) foot.parentNode.insertBefore(section, foot);
  else host.appendChild(section);
}
ensureWorkLog();

const cfg = window.COMPSCI || {};
const rootNodes = Array.from(document.querySelectorAll(".work-log"));

if (rootNodes.length && cfg.url && cfg.key) {
  const db = createClient(cfg.url, cfg.key);
  boot(db, rootNodes);
}

function boot(db, nodes) {
  db.auth.onAuthStateChange(function (_event, session) {
    nodes.forEach(function (node) {
      paint(db, node, session);
    });
  });
}

async function paint(db, node, session) {
  const unlocked = node.getAttribute("data-unlocked") === "1";
  const allLessons = node.hasAttribute("data-work-all");
  const lessonId = node.getAttribute("data-lesson") || lessonIdFromPath();
  const authBox = node.querySelector(".work-log-auth");
  const form = node.querySelector(".work-log-form");
  const status = node.querySelector(".work-log-status");
  const list = node.querySelector(".work-log-list");

  if (!unlocked) {
    if (authBox) authBox.replaceChildren();
    if (form) {
      form.querySelectorAll("textarea, button").forEach(function (el) {
        el.disabled = true;
      });
    }
    if (list) list.replaceChildren();
    return;
  }

  if (authBox) {
    authBox.replaceChildren();
    if (session && session.user) {
      const who = document.createElement("p");
      who.className = "work-who";
      who.textContent = "Signed in as " + (session.user.email || "you") + ".";
      const out = document.createElement("button");
      out.type = "button";
      out.className = "btn ghost";
      out.textContent = "Sign out";
      out.addEventListener("click", async function () {
        await db.auth.signOut();
      });
      authBox.append(who, out);
    } else {
      authBox.append(signInForm(db, status));
    }
  }

  if (form) {
    form.hidden = !session;
    if (!form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        submitWork(db, form, status, lessonId, list, allLessons);
      });
    }
  }

  if (!session) {
    if (list) list.replaceChildren();
    if (status && !status.textContent) {
      setStatus(status, "Sign in to submit and to see prior attempts.", false);
    }
    return;
  }

  await loadHistory(db, list, lessonId, allLessons, status);
}

function signInForm(db, status) {
  const form = document.createElement("form");
  form.className = "work-signin";
  const label = document.createElement("label");
  label.className = "work-log-label";
  label.setAttribute("for", "work-email");
  label.textContent = "Your email";
  const input = document.createElement("input");
  input.type = "email";
  input.id = "work-email";
  input.name = "email";
  input.required = true;
  input.autocomplete = "email";
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "btn";
  btn.textContent = "Send a sign-in link";
  form.append(label, input, btn);
  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    btn.disabled = true;
    setStatus(status, "Sending the link.", false);
    const otp = "signInWithOtp";
    const result = await db.auth[otp]({
      email: input.value.trim(),
      options: { emailRedirectTo: window.location.href }
    });
    btn.disabled = false;
    if (result.error) {
      setStatus(status, "Could not send the link. Try again.", true);
      return;
    }
    setStatus(status, "I sent a link to your email. Open it on this same device.", false);
  });
  return form;
}

async function submitWork(db, form, status, lessonId, list, allLessons) {
  if (!lessonId) {
    setStatus(status, "This page has no lesson id. I cannot save.", true);
    return;
  }
  const box = form.querySelector("textarea");
  const btn = form.querySelector("button[type=submit]");
  const body = box.value.trim();
  if (!body) {
    setStatus(status, "Write something before you submit.", true);
    return;
  }
  const userRes = await db.auth.getUser();
  if (userRes.error || !userRes.data.user) {
    setStatus(status, "Sign in first.", true);
    return;
  }
  btn.disabled = true;
  setStatus(status, "Saving.", false);
  const result = await db.from("submissions").insert({
    user_id: userRes.data.user.id,
    lesson_id: lessonId,
    body: body
  });
  btn.disabled = false;
  if (result.error) {
    setStatus(status, "Could not save. Try again.", true);
    return;
  }
  box.value = "";
  setStatus(status, "Saved. I grade this. Opening the page does not make you competent.", false);
  await loadHistory(db, list, lessonId, allLessons, status, true);
}

async function loadHistory(db, list, lessonId, allLessons, status, keepStatus) {
  if (!list) return;
  let q = db.from("submissions").select("id, lesson_id, body, created_at, evaluations(feedback, rating, created_at)").order("created_at", { ascending: false });
  if (!allLessons && lessonId) q = q.eq("lesson_id", lessonId);
  const result = await q;
  if (result.error) {
    list.replaceChildren();
    if (!keepStatus) setStatus(status, "Could not load prior attempts.", true);
    return;
  }
  const data = result.data || [];
  list.replaceChildren();
  if (!data.length) {
    const empty = document.createElement("li");
    empty.className = "work-empty";
    empty.textContent = "No attempts yet.";
    list.append(empty);
    return;
  }
  data.forEach(function (row) { list.append(attemptItem(row, allLessons)); });
}

function attemptItem(row, showLesson) {
  const li = document.createElement("li");
  if (showLesson && row.lesson_id) {
    const lesson = document.createElement("p");
    lesson.className = "work-lesson";
    lesson.textContent = prettyLesson(row.lesson_id);
    li.append(lesson);
  }
  const when = document.createElement("p");
  when.className = "work-when";
  when.textContent = fmtTime(row.created_at);
  const pre = document.createElement("pre");
  pre.className = "work-body";
  pre.textContent = row.body || "";
  li.append(when, pre);
  const raw = row.evaluations;
  const evals = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!evals.length) {
    const none = document.createElement("p");
    none.className = "work-eval-none";
    none.textContent = "No feedback yet.";
    li.append(none);
    return li;
  }
  evals.slice().sort(function (a, b) {
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  }).forEach(function (ev) {
    const wrap = document.createElement("div");
    wrap.className = "work-eval";
    const k = document.createElement("p");
    k.className = "kicker";
    k.textContent = "My feedback";
    const p = document.createElement("p");
    p.textContent = ev.feedback || "";
    wrap.append(k, p);
    if (ev.rating) {
      const r = document.createElement("p");
      r.className = "work-eval-rating";
      r.textContent = "Rating: " + ev.rating;
      wrap.append(r);
    }
    li.append(wrap);
  });
  return li;
}

function prettyLesson(id) {
  const parts = String(id).split("-");
  if (parts.length < 2) return id;
  const n = parts.pop();
  return parts.join("-").toUpperCase() + "." + n;
}

function lessonIdFromPath() {
  const m = window.location.pathname.match(/\/([^/]+)\.html$/i);
  return m ? m[1] : "";
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
  } catch (e) {
    return String(iso);
  }
}

function setStatus(node, text, bad) {
  if (!node) return;
  node.textContent = text || "";
  node.classList.toggle("is-bad", !!bad);
}

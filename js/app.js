import { TodoStore } from "./store.js";

(function () {
  "use strict";

  var CATEGORIES = [
    { id: "work", label: "업무", color: "#2f62b5", soft: "#e7eefb" },
    { id: "personal", label: "개인", color: "#e25b45", soft: "#fde8e3" },
    { id: "study", label: "공부", color: "#1b7a6a", soft: "#e5f4ef" },
    { id: "health", label: "건강", color: "#c98404", soft: "#fff4d6" },
    { id: "life", label: "생활", color: "#6d4cc4", soft: "#efe8fb" },
  ];

  var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var PRIORITY_LABEL = { high: "높음", medium: "보통", low: "낮음" };
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  var EMPTY_COPY = {
    day: ["이 날은 비어 있어요", "할 일을 추가하거나, 다른 날의 일정을 이 날짜로 끌어오세요."],
    upcoming: ["앞으로의 일정이 없어요", "달력에서 날을 고른 뒤 할 일을 적어 보세요."],
    overdue: ["밀린 일이 없어요", "날짜가 지난 할 일이 생기면 여기에 모입니다."],
    done: ["완료한 일이 없어요", "할 일 앞의 동그라미를 누르면 완료로 옮겨집니다."],
    all: ["할 일이 없어요", "첫 일정을 추가해 보세요."],
  };

  var nowState = { date: new Date() };
  var todos = [];
  var selectedDate = "";
  var viewYear = 0;
  var viewMonth = 0;
  var listMode = "day";
  var categoryFilter = "all";
  var priorityFilter = "all";
  var search = "";
  var quickCategory = "personal";
  var moveTaskId = null;
  var editingId = null;
  var pendingDeleteId = null;
  var popoverTodoId = null;
  var suppressClick = false;
  var toastTimer = 0;
  var flashId = "";

  var els = {
    clockHm: document.getElementById("clockHm"),
    clockSec: document.getElementById("clockSec"),
    clockDate: document.getElementById("clockDate"),
    watchingDate: document.getElementById("watchingDate"),
    hourHand: document.getElementById("hourHand"),
    minuteHand: document.getElementById("minuteHand"),
    secondHand: document.getElementById("secondHand"),
    searchInput: document.getElementById("searchInput"),
    statAll: document.getElementById("statAll"),
    statToday: document.getElementById("statToday"),
    statDone: document.getElementById("statDone"),
    statOverdue: document.getElementById("statOverdue"),
    todayMeter: document.getElementById("todayMeter"),
    statTodayBtn: document.getElementById("statTodayBtn"),
    prevMonth: document.getElementById("prevMonth"),
    nextMonth: document.getElementById("nextMonth"),
    todayBtn: document.getElementById("todayBtn"),
    monthLabel: document.getElementById("monthLabel"),
    monthCount: document.getElementById("monthCount"),
    legend: document.getElementById("legend"),
    weekdays: document.getElementById("weekdays"),
    calendarGrid: document.getElementById("calendarGrid"),
    calendarCard: document.getElementById("calendarCard"),
    tasksEyebrow: document.getElementById("tasksEyebrow"),
    tasksTitle: document.getElementById("tasksTitle"),
    tasksSub: document.getElementById("tasksSub"),
    panelClock: document.getElementById("panelClock"),
    focusDate: document.getElementById("focusDate"),
    taskTabs: document.getElementById("taskTabs"),
    priorityFilter: document.getElementById("priorityFilter"),
    quickDateLabel: document.getElementById("quickDateLabel"),
    quickCats: document.getElementById("quickCats"),
    quickAdd: document.getElementById("quickAdd"),
    quickTitle: document.getElementById("quickTitle"),
    quickTime: document.getElementById("quickTime"),
    openDetail: document.getElementById("openDetail"),
    dayline: document.getElementById("dayline"),
    taskList: document.getElementById("taskList"),
    goTodayBtn: document.getElementById("goTodayBtn"),
    popover: document.getElementById("popover"),
    popoverTitle: document.getElementById("popoverTitle"),
    popoverMeta: document.getElementById("popoverMeta"),
    popoverToggle: document.getElementById("popoverToggle"),
    moveBanner: document.getElementById("moveBanner"),
    moveName: document.getElementById("moveName"),
    moveDateInput: document.getElementById("moveDateInput"),
    cancelMove: document.getElementById("cancelMove"),
    editor: document.getElementById("editor"),
    editorForm: document.getElementById("editorForm"),
    editorHeading: document.getElementById("editorHeading"),
    editorCancel: document.getElementById("editorCancel"),
    editorDelete: document.getElementById("editorDelete"),
    categoryFields: document.getElementById("categoryFields"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmForm: document.getElementById("confirmForm"),
    confirmText: document.getElementById("confirmText"),
    confirmCancel: document.getElementById("confirmCancel"),
    syncStatus: document.getElementById("syncStatus"),
    syncStatusText: document.getElementById("syncStatusText"),
    toast: document.getElementById("toast"),
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function formatDateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseKey(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatKoreanDate(key) {
    var date = parseKey(key);
    return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일 " + WEEKDAYS[date.getDay()] + "요일";
  }

  function shortDate(key) {
    var date = parseKey(key);
    return (date.getMonth() + 1) + "월 " + date.getDate() + "일";
  }

  function relativeLabel(key) {
    var diff = Math.round((parseKey(key) - parseKey(formatDateKey(nowState.date))) / 86400000);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff === -1) return "어제";
    if (diff === 2) return "모레";
    if (diff === -2) return "그저께";
    return "";
  }

  function categoryById(id) {
    return CATEGORIES.find(function (cat) { return cat.id === id; }) || CATEGORIES[1];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayKey() {
    return formatDateKey(nowState.date);
  }

  function isOverdue(todo) {
    return !todo.completed && todo.date < todayKey();
  }

  function normalizeTime(value) {
    var match = /^(\d{2}):(\d{2})/.exec(value || "");
    return match ? match[1] + ":" + match[2] : "";
  }

  function timePercent(time) {
    var parts = time.split(":").map(Number);
    var mins = parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
    var ratio = (mins - 7 * 60) / (15 * 60);
    return Math.min(100, Math.max(0, ratio * 100));
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.hidden = true;
    }, 2200);
  }

  function setSyncState(state) {
    var labels = {
      connecting: "Firebase 연결 중",
      online: "실시간 동기화 중",
      offline: "브라우저에 저장됨",
    };
    els.syncStatus.dataset.state = state;
    els.syncStatusText.textContent = labels[state] || labels.connecting;
  }

  function persist(todo) {
    TodoStore.save(todo).then(function (saved) {
      if (!saved) setSyncState("offline");
    });
  }

  function persistDelete(id) {
    TodoStore.remove(id).then(function (removed) {
      if (!removed) setSyncState("offline");
    });
  }

  function createTodo(partial) {
    var now = Date.now();
    var category = CATEGORIES.some(function (cat) { return cat.id === partial.category; }) ? partial.category : "personal";
    var priority = PRIORITY_LABEL[partial.priority] ? partial.priority : "medium";
    return {
      id: uid(),
      title: partial.title.trim().slice(0, 80),
      notes: String(partial.notes || "").trim().slice(0, 400),
      date: partial.date,
      time: normalizeTime(partial.time),
      category: category,
      priority: priority,
      completed: Boolean(partial.completed),
      createdAt: now,
      updatedAt: now,
    };
  }

  function repair(item) {
    if (!item || typeof item.title !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
    var title = item.title.trim().slice(0, 80);
    if (!title) return null;
    return {
      id: String(item.id || uid()),
      title: title,
      notes: String(item.notes || "").slice(0, 400),
      date: item.date,
      time: normalizeTime(item.time),
      category: CATEGORIES.some(function (cat) { return cat.id === item.category; }) ? item.category : "personal",
      priority: PRIORITY_LABEL[item.priority] ? item.priority : "medium",
      completed: Boolean(item.completed),
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
    };
  }

  function buildSeed() {
    function shift(days) {
      var date = new Date(nowState.date);
      date.setDate(date.getDate() + days);
      return formatDateKey(date);
    }
    return [
      { title: "물 한 잔 마시기", date: shift(0), time: "08:00", category: "health", priority: "low", completed: true },
      { title: "팀 회의 준비", date: shift(0), time: "10:00", category: "work", priority: "high", notes: "어제 공유한 초안을 한 번 더 보기" },
      { title: "저녁 장보기", date: shift(0), time: "18:30", category: "life", priority: "medium" },
      { title: "읽던 책 20쪽", date: shift(0), time: "", category: "personal", priority: "low" },
      { title: "자바스크립트 복습", date: shift(1), time: "14:00", category: "study", priority: "medium" },
      { title: "친구와 저녁", date: shift(2), time: "19:00", category: "personal", priority: "medium" },
      { title: "월간 보고서 정리", date: shift(3), time: "11:00", category: "work", priority: "high", notes: "지난달 숫자만 먼저 모으기" },
      { title: "주말 산책", date: shift(5), time: "09:00", category: "health", priority: "low" },
      { title: "병원 다녀오기", date: shift(-1), time: "09:30", category: "health", priority: "high", completed: true },
      { title: "밀린 메일 정리", date: shift(-2), time: "16:00", category: "work", priority: "medium" },
    ].map(createTodo);
  }

  function passesFilters(todo) {
    if (categoryFilter !== "all" && todo.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && todo.priority !== priorityFilter) return false;
    var query = search.trim().toLowerCase();
    if (!query) return true;
    return (todo.title + " " + todo.notes).toLowerCase().indexOf(query) !== -1;
  }

  function compareTodos(a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.time !== b.time) {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time < b.time ? -1 : 1;
    }
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.createdAt - b.createdAt;
  }

  function getListedTodos() {
    var today = todayKey();
    return todos.filter(function (todo) {
      if (!passesFilters(todo)) return false;
      if (listMode === "day") return todo.date === selectedDate;
      if (listMode === "upcoming") return todo.date > today && !todo.completed;
      if (listMode === "overdue") return todo.date < today && !todo.completed;
      if (listMode === "done") return todo.completed;
      return true;
    }).sort(function (a, b) {
      if (a.date !== b.date && listMode !== "day") {
        if (listMode === "done") return a.date < b.date ? 1 : -1;
        return a.date < b.date ? -1 : 1;
      }
      return compareTodos(a, b);
    });
  }

  function buildCells(year, month) {
    var firstWeekday = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < firstWeekday; i += 1) {
      cells.push({ date: new Date(year, month - 1, prevDays - firstWeekday + 1 + i), outside: true });
    }
    for (i = 1; i <= daysInMonth; i += 1) {
      cells.push({ date: new Date(year, month, i), outside: false });
    }
    var next = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ date: new Date(year, month + 1, next), outside: true });
      next += 1;
    }
    return cells;
  }

  function chipTemplate(todo) {
    var cat = categoryById(todo.category);
    var label = (todo.time ? todo.time + " " : "") + todo.title;
    return '<button type="button" class="chip' + (todo.completed ? " is-done" : "") + '" draggable="true" data-id="' + todo.id + '" style="--cat:' + cat.color + ';--cat-soft:' + cat.soft + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + "</button>";
  }

  function taskTemplate(todo) {
    var cat = categoryById(todo.category);
    var classes = "task" + (todo.completed ? " is-done" : "") + (isOverdue(todo) ? " is-overdue" : "") + (todo.id === flashId ? " is-flash" : "");
    var rel = relativeLabel(todo.date);
    var datePill = listMode === "day" ? "" : '<span class="pill">' + escapeHtml(shortDate(todo.date) + (rel ? " · " + rel : "")) + "</span>";
    var overduePill = isOverdue(todo) ? '<span class="pill overdue">지연</span>' : "";
    var notes = todo.notes ? '<p class="task-notes">' + escapeHtml(todo.notes) + "</p>" : "";
    return (
      '<article class="' + classes + '" id="task-' + todo.id + '" data-id="' + todo.id + '" style="--cat:' + cat.color + ";--cat-soft:" + cat.soft + '">' +
        '<button type="button" class="check" data-action="toggle" data-id="' + todo.id + '" aria-pressed="' + todo.completed + '" aria-label="' + (todo.completed ? "완료 취소" : "완료") + '">✓</button>' +
        '<div class="task-body"><h3 class="task-title">' + escapeHtml(todo.title) + "</h3>" +
          '<div class="task-meta"><span class="pill">' + (todo.time ? escapeHtml(todo.time) : "시간 미정") + "</span>" +
            '<span class="pill cat">' + escapeHtml(cat.label) + "</span>" +
            '<span class="pill priority-' + todo.priority + '">' + PRIORITY_LABEL[todo.priority] + "</span>" +
            datePill + overduePill + "</div>" + notes + "</div>" +
        '<div class="task-actions">' +
          '<button type="button" data-action="edit" data-id="' + todo.id + '">수정</button>' +
          '<button type="button" data-action="move" data-id="' + todo.id + '">날짜 이동</button>' +
          '<button type="button" class="danger" data-action="delete" data-id="' + todo.id + '">삭제</button>' +
        "</div></article>"
    );
  }

  function renderWeekdays() {
    els.weekdays.innerHTML = WEEKDAYS.map(function (name) { return "<span>" + name + "</span>"; }).join("");
  }

  function renderLegend() {
    var items = [{ id: "all", label: "전체", color: "#241c16", soft: "#fff" }].concat(CATEGORIES);
    els.legend.innerHTML = items.map(function (cat) {
      return '<button type="button" data-category="' + cat.id + '" style="--cat:' + cat.color + ";--cat-soft:" + cat.soft + '">' + cat.label + "</button>";
    }).join("");
  }

  function renderCategoryChoices() {
    CATEGORIES.forEach(function (cat) {
      var label = document.createElement("label");
      label.style.setProperty("--cat", cat.color);
      label.innerHTML = '<input type="radio" name="category" value="' + cat.id + '"' + (cat.id === "personal" ? " checked" : "") + " /> " + cat.label;
      els.categoryFields.appendChild(label);
    });
  }

  function renderQuickCats() {
    els.quickCats.innerHTML = CATEGORIES.map(function (cat) {
      return '<button type="button" data-category="' + cat.id + '" style="--cat:' + cat.color + ";--cat-soft:" + cat.soft + '">' + cat.label + "</button>";
    }).join("");
  }

  function renderCalendar() {
    els.monthLabel.textContent = viewYear + "년 " + (viewMonth + 1) + "월";
    var monthKey = viewYear + "-" + pad(viewMonth + 1);
    var monthCount = todos.filter(function (todo) { return todo.date.indexOf(monthKey) === 0 && passesFilters(todo); }).length;
    els.monthCount.textContent = "일정 " + monthCount + "개";
    var source = todos.find(function (todo) { return todo.id === moveTaskId; });
    var today = todayKey();
    els.calendarGrid.classList.toggle("is-moving", Boolean(moveTaskId));
    els.calendarGrid.innerHTML = buildCells(viewYear, viewMonth).map(function (cell) {
      var key = formatDateKey(cell.date);
      var dayTodos = todos.filter(function (todo) { return todo.date === key && passesFilters(todo); }).sort(compareTodos);
      var chips = dayTodos.slice(0, 2).map(chipTemplate).join("");
      var more = dayTodos.length > 2 ? '<span class="more">+' + (dayTodos.length - 2) + "</span>" : "";
      var classes = ["day"];
      if (cell.outside) classes.push("is-outside");
      if (key === today) classes.push("is-today");
      if (key === selectedDate) classes.push("is-selected");
      if (source && source.date === key) classes.push("is-source");
      if (cell.date.getDay() === 0) classes.push("is-sun");
      if (cell.date.getDay() === 6) classes.push("is-sat");
      return '<div class="' + classes.join(" ") + '" data-date="' + key + '">' +
        '<div class="day-top"><button type="button" class="day-num" aria-label="' + formatKoreanDate(key) + ' 선택, 일정 ' + dayTodos.length + '개">' + cell.date.getDate() + "</button>" +
        (dayTodos.length ? '<span class="day-count">' + dayTodos.length + "</span>" : "") +
        '</div><div class="chips">' + chips + more + "</div></div>";
    }).join("");
  }

  function renderDayline() {
    if (listMode !== "day") {
      els.dayline.hidden = true;
      els.dayline.innerHTML = "";
      return;
    }
    var timed = todos.filter(function (todo) {
      return todo.date === selectedDate && todo.time && passesFilters(todo);
    }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var isToday = selectedDate === todayKey();
    if (!timed.length && !isToday) {
      els.dayline.hidden = true;
      els.dayline.innerHTML = "";
      return;
    }
    var seen = {};
    timed.forEach(function (todo) { seen[todo.time] = (seen[todo.time] || 0) + 1; });
    var rows = Math.max.apply(null, [1].concat(Object.keys(seen).map(function (key) { return seen[key]; })));
    var slots = {};
    var dots = timed.map(function (todo) {
      var cat = categoryById(todo.category);
      var slot = slots[todo.time] || 0;
      slots[todo.time] = slot + 1;
      return '<button type="button" class="dayline-dot' + (todo.completed ? " is-done" : "") + '" data-id="' + todo.id + '" style="left:' + timePercent(todo.time) + "%;top:" + (8 + slot * 14) + "px;--cat:" + cat.color + '" title="' + escapeHtml(todo.time + " " + todo.title) + '"></button>';
    }).join("");
    els.dayline.hidden = false;
    els.dayline.innerHTML =
      '<div class="dayline-head"><strong>시간표</strong><span id="daylineCaption">' + (isToday ? "오늘 시간표" : "선택한 날") + "</span></div>" +
      '<div class="dayline-track" style="height:' + (18 + rows * 14) + 'px">' + dots +
        '<span id="daylineNow" class="dayline-now"' + (isToday ? "" : " hidden") + "><em></em></span></div>" +
      '<div class="dayline-scale"><span>7시</span><span>12시</span><span>17시</span><span>22시</span></div>';
    updateDaylineNow();
  }

  function renderList() {
    var items = getListedTodos();
    var scroll = els.taskList.scrollTop;
    if (!items.length) {
      var copy = search.trim() ? ["검색 결과가 없어요", "다른 단어로 찾거나 분류 필터를 풀어 보세요."] : EMPTY_COPY[listMode];
      els.taskList.innerHTML = '<div class="empty"><strong>' + copy[0] + "</strong><p>" + copy[1] + "</p></div>";
      return;
    }
    if (listMode === "day") {
      els.taskList.innerHTML = items.map(taskTemplate).join("");
    } else {
      var groups = [];
      items.forEach(function (todo) {
        var last = groups[groups.length - 1];
        if (!last || last.date !== todo.date) groups.push({ date: todo.date, items: [todo] });
        else last.items.push(todo);
      });
      els.taskList.innerHTML = groups.map(function (group) {
        var rel = relativeLabel(group.date);
        return '<section class="group"><button type="button" class="group-date" data-date="' + group.date + '"><strong>' +
          escapeHtml(formatKoreanDate(group.date)) + "</strong><span>" + escapeHtml(rel) + "</span><em>" + group.items.length + "개</em></button>" +
          group.items.map(taskTemplate).join("") + "</section>";
      }).join("");
    }
    els.taskList.scrollTop = scroll;
    if (flashId) {
      window.setTimeout(function () { flashId = ""; }, 1200);
    }
  }

  function renderPanelText() {
    var items = getListedTodos();
    var rel = relativeLabel(selectedDate);
    if (listMode === "day") {
      els.tasksEyebrow.textContent = rel || "선택한 날짜";
      els.tasksTitle.textContent = formatKoreanDate(selectedDate);
    } else if (listMode === "upcoming") {
      els.tasksEyebrow.textContent = "다가오는 일정";
      els.tasksTitle.textContent = "앞으로의 할 일";
    } else if (listMode === "overdue") {
      els.tasksEyebrow.textContent = "날짜가 지난 일정";
      els.tasksTitle.textContent = "지연된 할 일";
    } else if (listMode === "done") {
      els.tasksEyebrow.textContent = "끝낸 일정";
      els.tasksTitle.textContent = "완료한 할 일";
    } else {
      els.tasksEyebrow.textContent = "모든 일정";
      els.tasksTitle.textContent = "전체 할 일";
    }
    els.tasksSub.textContent = items.length + "개의 할 일";
    els.quickDateLabel.textContent = shortDate(selectedDate) + " " + WEEKDAYS[parseKey(selectedDate).getDay()] + "요일" + (rel ? " · " + rel : "");
    els.watchingDate.textContent = "보는 날 · " + shortDate(selectedDate) + (rel ? " · " + rel : "");
    els.taskTabs.querySelectorAll("[data-mode]").forEach(function (tab) {
      var on = tab.dataset.mode === listMode;
      tab.setAttribute("aria-selected", String(on));
    });
    els.legend.querySelectorAll("[data-category]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.category === categoryFilter));
    });
    els.quickCats.querySelectorAll("[data-category]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.category === quickCategory));
    });
    document.querySelectorAll(".stat[data-mode]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.mode === listMode);
    });
    els.statTodayBtn.classList.toggle("is-active", listMode === "day" && selectedDate === todayKey());
  }

  function syncStats() {
    var today = todayKey();
    var todayItems = todos.filter(function (todo) { return todo.date === today; });
    var doneToday = todayItems.filter(function (todo) { return todo.completed; }).length;
    els.statAll.textContent = String(todos.length);
    els.statToday.textContent = String(todayItems.filter(function (todo) { return !todo.completed; }).length);
    els.statDone.textContent = String(todos.filter(function (todo) { return todo.completed; }).length);
    els.statOverdue.textContent = String(todos.filter(function (todo) { return isOverdue(todo); }).length);
    els.todayMeter.style.width = todayItems.length ? (doneToday / todayItems.length) * 100 + "%" : "0%";
  }

  function renderAll() {
    closePopover();
    syncStats();
    renderCalendar();
    renderPanelText();
    renderDayline();
    renderList();
    updatePanelClock();
    document.body.classList.toggle("is-move-mode", Boolean(moveTaskId));
  }

  function updatePanelClock() {
    var show = listMode === "day" && selectedDate === todayKey();
    els.panelClock.hidden = !show;
    if (show) {
      var now = nowState.date;
      els.panelClock.textContent = "지금 " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    }
  }

  function updateDaylineNow() {
    var marker = document.getElementById("daylineNow");
    if (!marker) return;
    var now = nowState.date;
    var isToday = listMode === "day" && selectedDate === todayKey();
    marker.hidden = !isToday;
    if (!isToday) return;
    marker.style.left = timePercent(pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds())) + "%";
    marker.querySelector("em").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
  }

  function updateClock() {
    var previous = formatDateKey(nowState.date);
    var now = new Date();
    nowState.date = now;
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();
    els.clockHm.textContent = pad(hours) + ":" + pad(minutes);
    els.clockSec.textContent = pad(seconds);
    els.clockDate.textContent = (now.getMonth() + 1) + "월 " + now.getDate() + "일 " + WEEKDAYS[now.getDay()] + "요일";
    els.hourHand.style.transform = "rotate(" + ((hours % 12) * 30 + minutes * 0.5) + "deg)";
    els.minuteHand.style.transform = "rotate(" + (minutes * 6 + seconds * 0.1) + "deg)";
    els.secondHand.style.transform = "rotate(" + seconds * 6 + "deg)";
    updatePanelClock();
    updateDaylineNow();
    if (previous !== formatDateKey(now)) renderAll();
  }

  function selectDate(key) {
    selectedDate = key;
    listMode = "day";
    var parts = key.split("-").map(Number);
    viewYear = parts[0];
    viewMonth = parts[1] - 1;
    renderAll();
  }

  function changeMonth(delta) {
    var next = new Date(viewYear, viewMonth + delta, 1);
    viewYear = next.getFullYear();
    viewMonth = next.getMonth();
    renderCalendar();
  }

  function goToday() {
    selectDate(todayKey());
  }

  function closePopover() {
    els.popover.hidden = true;
    popoverTodoId = null;
  }

  function placePopover(anchor) {
    els.popover.hidden = false;
    var rect = anchor.getBoundingClientRect();
    var width = els.popover.offsetWidth;
    var height = els.popover.offsetHeight;
    var left = rect.left;
    var top = rect.bottom + 8;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
    els.popover.style.left = left + "px";
    els.popover.style.top = top + "px";
  }

  function openPopover(id, anchor) {
    var todo = todos.find(function (item) { return item.id === id; });
    if (!todo) return;
    popoverTodoId = id;
    var cat = categoryById(todo.category);
    els.popoverTitle.textContent = todo.title;
    els.popoverMeta.textContent = shortDate(todo.date) + " " + (todo.time || "시간 미정") + " · " + cat.label + " · " + PRIORITY_LABEL[todo.priority];
    els.popoverToggle.textContent = todo.completed ? "되돌리기" : "완료";
    placePopover(anchor);
  }

  function endMoveMode() {
    moveTaskId = null;
    els.moveBanner.hidden = true;
    document.body.classList.remove("is-move-mode");
  }

  function startMove(id) {
    var todo = todos.find(function (item) { return item.id === id; });
    if (!todo) return;
    closePopover();
    moveTaskId = id;
    els.moveName.textContent = todo.title;
    els.moveDateInput.value = todo.date;
    els.moveBanner.hidden = false;
    document.body.classList.add("is-move-mode");
    renderCalendar();
    els.calendarCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function cancelMove() {
    endMoveMode();
    renderCalendar();
  }

  function moveTodo(id, date) {
    var todo = todos.find(function (item) { return item.id === id; });
    if (!todo || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
    if (todo.date === date) {
      endMoveMode();
      renderCalendar();
      toast("이미 그 날짜에 있어요");
      return;
    }
    todo.date = date;
    todo.updatedAt = Date.now();
    flashId = todo.id;
    endMoveMode();
    persist(todo);
    selectDate(date);
    toast(shortDate(date) + "로 옮겼어요");
  }

  function toggleTodo(id) {
    var todo = todos.find(function (item) { return item.id === id; });
    if (!todo) return;
    todo.completed = !todo.completed;
    todo.updatedAt = Date.now();
    persist(todo);
    renderAll();
  }

  function askDelete(id) {
    var todo = todos.find(function (item) { return item.id === id; });
    if (!todo) return;
    pendingDeleteId = id;
    els.confirmText.textContent = "「" + todo.title + "」 할 일을 삭제할까요?";
    els.confirmDialog.showModal();
  }

  function deleteTodo(id) {
    var target = id;
    todos = todos.filter(function (todo) { return todo.id !== target; });
    if (moveTaskId === target) endMoveMode();
    persistDelete(target);
    renderAll();
    toast("삭제했어요");
  }

  function openEditor(todo) {
    editingId = todo ? todo.id : null;
    var form = els.editorForm;
    els.editorHeading.textContent = todo ? "할 일 수정" : "할 일 추가";
    form.elements.title.value = todo ? todo.title : "";
    form.elements.date.value = todo ? todo.date : selectedDate;
    form.elements.time.value = todo ? todo.time : "";
    form.elements.notes.value = todo ? todo.notes : "";
    form.elements.completed.checked = Boolean(todo && todo.completed);
    var category = todo ? todo.category : quickCategory;
    var priority = todo ? todo.priority : "medium";
    var categoryInput = form.querySelector('input[name="category"][value="' + category + '"]');
    var priorityInput = form.querySelector('input[name="priority"][value="' + priority + '"]');
    if (categoryInput) categoryInput.checked = true;
    if (priorityInput) priorityInput.checked = true;
    els.editorDelete.hidden = !todo;
    closePopover();
    els.editor.showModal();
    form.elements.title.focus();
  }

  function onEditorSubmit(event) {
    event.preventDefault();
    var form = els.editorForm;
    var title = form.elements.title.value.trim();
    var date = form.elements.date.value;
    if (!title) {
      toast("할 일을 입력해 주세요");
      form.elements.title.focus();
      return;
    }
    if (!date) {
      toast("날짜를 선택해 주세요");
      return;
    }
    var data = {
      title: title,
      notes: form.elements.notes.value,
      date: date,
      time: form.elements.time.value,
      category: new FormData(form).get("category") || quickCategory,
      priority: new FormData(form).get("priority") || "medium",
      completed: form.elements.completed.checked,
    };
    var savedTodo;
    if (editingId) {
      var current = todos.find(function (todo) { return todo.id === editingId; });
      if (!current) return;
      current.title = data.title.slice(0, 80);
      current.notes = String(data.notes || "").trim().slice(0, 400);
      current.date = data.date;
      current.time = normalizeTime(data.time);
      current.category = data.category;
      current.priority = data.priority;
      current.completed = data.completed;
      current.updatedAt = Date.now();
      savedTodo = current;
      flashId = current.id;
      toast("수정했어요");
    } else {
      var created = createTodo(data);
      todos.push(created);
      savedTodo = created;
      flashId = created.id;
      els.quickTitle.value = "";
      toast("추가했어요");
    }
    var savedId = editingId;
    els.editor.close();
    if (!savedId) quickCategory = data.category;
    persist(savedTodo);
    selectDate(data.date);
  }

  function bindBackdrop(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  function bindEvents() {
    els.goTodayBtn.addEventListener("click", goToday);
    els.todayBtn.addEventListener("click", goToday);
    els.prevMonth.addEventListener("click", function () { changeMonth(-1); });
    els.nextMonth.addEventListener("click", function () { changeMonth(1); });
    els.focusDate.addEventListener("click", function () {
      var parts = selectedDate.split("-").map(Number);
      viewYear = parts[0];
      viewMonth = parts[1] - 1;
      renderCalendar();
      els.calendarCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    els.searchInput.addEventListener("input", function () {
      search = els.searchInput.value;
      renderAll();
    });
    els.priorityFilter.addEventListener("change", function () {
      priorityFilter = els.priorityFilter.value;
      renderAll();
    });
    els.legend.addEventListener("click", function (event) {
      var button = event.target.closest("[data-category]");
      if (!button) return;
      categoryFilter = button.dataset.category;
      renderAll();
    });
    els.quickCats.addEventListener("click", function (event) {
      var button = event.target.closest("[data-category]");
      if (!button) return;
      quickCategory = button.dataset.category;
      renderPanelText();
    });
    document.querySelector(".stats").addEventListener("click", function (event) {
      var button = event.target.closest(".stat");
      if (!button) return;
      if (button.id === "statTodayBtn") {
        goToday();
        return;
      }
      listMode = button.dataset.mode;
      renderAll();
    });
    els.taskTabs.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-mode]");
      if (!tab) return;
      listMode = tab.dataset.mode;
      renderAll();
    });

    els.quickAdd.addEventListener("submit", function (event) {
      event.preventDefault();
      var title = els.quickTitle.value.trim();
      if (!title) {
        toast("할 일을 입력해 주세요");
        return;
      }
      var created = createTodo({
        title: title,
        date: selectedDate,
        time: els.quickTime.value,
        category: quickCategory,
        priority: "medium",
      });
      todos.push(created);
      flashId = created.id;
      els.quickTitle.value = "";
      persist(created);
      listMode = "day";
      renderAll();
      toast("추가했어요");
    });
    els.openDetail.addEventListener("click", function () {
      openEditor(null);
      els.editorForm.elements.title.value = els.quickTitle.value;
      els.editorForm.elements.time.value = els.quickTime.value;
      els.editorForm.elements.date.value = selectedDate;
    });

    els.calendarGrid.addEventListener("click", function (event) {
      if (suppressClick) return;
      var day = event.target.closest(".day");
      if (!day) return;
      if (moveTaskId) {
        moveTodo(moveTaskId, day.dataset.date);
        return;
      }
      var chip = event.target.closest(".chip");
      if (chip) {
        event.stopPropagation();
        openPopover(chip.dataset.id, chip);
        return;
      }
      selectDate(day.dataset.date);
    });
    els.calendarGrid.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var day = event.target.closest(".day");
      if (!day || event.target !== day) return;
      event.preventDefault();
      if (moveTaskId) moveTodo(moveTaskId, day.dataset.date);
      else selectDate(day.dataset.date);
    });
    els.calendarGrid.addEventListener("dragstart", function (event) {
      var chip = event.target.closest(".chip");
      if (!chip) return;
      suppressClick = true;
      chip.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", chip.dataset.id);
    });
    els.calendarGrid.addEventListener("dragover", function (event) {
      var day = event.target.closest(".day");
      if (!day) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      els.calendarGrid.querySelectorAll(".drag-over").forEach(function (node) {
        if (node !== day) node.classList.remove("drag-over");
      });
      day.classList.add("drag-over");
    });
    els.calendarGrid.addEventListener("drop", function (event) {
      var day = event.target.closest(".day");
      if (!day) return;
      event.preventDefault();
      var id = event.dataTransfer.getData("text/plain");
      day.classList.remove("drag-over");
      if (id) moveTodo(id, day.dataset.date);
    });
    document.addEventListener("dragend", function () {
      document.querySelectorAll(".drag-over, .dragging").forEach(function (node) {
        node.classList.remove("drag-over", "dragging");
      });
      window.setTimeout(function () { suppressClick = false; }, 80);
    });

    els.dayline.addEventListener("click", function (event) {
      var dot = event.target.closest(".dayline-dot");
      if (!dot) return;
      event.stopPropagation();
      openPopover(dot.dataset.id, dot);
      var row = document.getElementById("task-" + dot.dataset.id);
      if (row) row.scrollIntoView({ block: "nearest" });
    });
    els.taskList.addEventListener("click", function (event) {
      var groupButton = event.target.closest(".group-date");
      if (groupButton) {
        selectDate(groupButton.dataset.date);
        return;
      }
      var button = event.target.closest("[data-action]");
      if (!button) return;
      var id = button.dataset.id;
      if (button.dataset.action === "toggle") toggleTodo(id);
      if (button.dataset.action === "edit") openEditor(todos.find(function (todo) { return todo.id === id; }));
      if (button.dataset.action === "move") startMove(id);
      if (button.dataset.action === "delete") askDelete(id);
    });

    els.popover.addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button || !popoverTodoId) return;
      var id = popoverTodoId;
      var todo = todos.find(function (item) { return item.id === id; });
      if (button.dataset.action === "toggle") {
        closePopover();
        toggleTodo(id);
      } else if (button.dataset.action === "edit") {
        openEditor(todo);
      } else if (button.dataset.action === "move") {
        startMove(id);
      } else if (button.dataset.action === "delete") {
        closePopover();
        askDelete(id);
      }
    });
    document.addEventListener("click", function (event) {
      if (els.popover.hidden) return;
      if (event.target.closest("#popover")) return;
      closePopover();
    });

    els.moveBanner.addEventListener("submit", function (event) {
      event.preventDefault();
      if (moveTaskId) moveTodo(moveTaskId, els.moveDateInput.value);
    });
    els.cancelMove.addEventListener("click", cancelMove);

    els.editorForm.addEventListener("submit", onEditorSubmit);
    els.editorCancel.addEventListener("click", function () { els.editor.close(); });
    els.editorDelete.addEventListener("click", function () {
      var id = editingId;
      els.editor.close();
      if (id) askDelete(id);
    });
    els.editor.addEventListener("close", function () { editingId = null; });
    bindBackdrop(els.editor);

    els.confirmForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var id = pendingDeleteId;
      pendingDeleteId = null;
      els.confirmDialog.close();
      if (id) deleteTodo(id);
    });
    els.confirmCancel.addEventListener("click", function () {
      pendingDeleteId = null;
      els.confirmDialog.close();
    });
    els.confirmDialog.addEventListener("close", function () { pendingDeleteId = null; });
    bindBackdrop(els.confirmDialog);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (els.editor.open || els.confirmDialog.open) return;
        if (!els.popover.hidden) {
          closePopover();
          return;
        }
        if (moveTaskId) cancelMove();
        return;
      }
      if (els.editor.open || els.confirmDialog.open) return;
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeMonth(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changeMonth(1);
      }
    });
    window.addEventListener("resize", function () {
      if (!els.popover.hidden) closePopover();
    });
  }

  async function init() {
    nowState.date = new Date();
    selectedDate = todayKey();
    viewYear = nowState.date.getFullYear();
    viewMonth = nowState.date.getMonth();
    renderWeekdays();
    renderLegend();
    renderCategoryChoices();
    renderQuickCats();
    bindEvents();
    var loaded = await TodoStore.load();
    if (loaded == null) {
      todos = buildSeed();
      await TodoStore.saveAll(todos);
    } else {
      todos = loaded.map(repair).filter(Boolean);
    }
    renderAll();
    TodoStore.subscribe(
      function (remoteTodos) {
        todos = remoteTodos.map(repair).filter(Boolean);
        renderAll();
      },
      function (connected) {
        setSyncState(connected ? "online" : "offline");
      },
    );
    updateClock();
    window.setInterval(updateClock, 1000);
  }

  init();
})();

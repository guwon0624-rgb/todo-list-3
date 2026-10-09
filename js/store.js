import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {
  child,
  get,
  getDatabase,
  onValue,
  ref,
  remove,
  set,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

/*
 * Firebase 프로젝트 연결 정보는 클라이언트 앱에 포함되는 공개 설정입니다.
 * 실제 데이터 접근 권한은 Firebase Console의 Realtime Database 규칙으로 관리하세요.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBsGuhD66Od1agEqNTPl2KG2kkQOdDEvZo",
  authDomain: "todo-list-3-e6685.firebaseapp.com",
  projectId: "todo-list-3-e6685",
  storageBucket: "todo-list-3-e6685.firebasestorage.app",
  messagingSenderId: "381254957647",
  appId: "1:381254957647:web:c4ced3a7b14939551b483a",
  databaseURL: "https://todo-list-3-e6685-default-rtdb.firebaseio.com",
  measurementId: "G-NBYFDHGPCL",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const todosRef = ref(db, "todos");
const initializedRef = ref(db, "meta/initialized");
const connectionRef = ref(db, ".info/connected");
const STORAGE_KEY = "harupan.todos.v1";
const DATABASE_TIMEOUT_MS = 5000;

isAnalyticsSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {
    // Analytics가 지원되지 않는 환경이어도 할 일 기능은 계속 동작합니다.
  });

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveLocal(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function snapshotToTodos(snapshot) {
  const value = snapshot.val();
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).map(([id, todo]) => ({
    id,
    ...todo,
  }));
}

function todoData(todo) {
  const { id, ...data } = todo;
  return data;
}

function saveOneLocal(todo) {
  const localTodos = loadLocal() || [];
  const index = localTodos.findIndex((item) => String(item.id) === String(todo.id));

  if (index >= 0) localTodos[index] = todo;
  else localTodos.push(todo);

  saveLocal(localTodos);
}

function removeOneLocal(id) {
  const localTodos = loadLocal() || [];
  saveLocal(localTodos.filter((todo) => String(todo.id) !== String(id)));
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), DATABASE_TIMEOUT_MS);
    }),
  ]);
}

async function load() {
  try {
    const [snapshot, initializedSnapshot] = await withTimeout(
      Promise.all([get(todosRef), get(initializedRef)]),
      "Realtime Database 불러오기 시간이 초과되었습니다.",
    );
    const remoteTodos = snapshotToTodos(snapshot);

    if (remoteTodos.length > 0) {
      saveLocal(remoteTodos);
      set(initializedRef, true).catch(() => {});
      return remoteTodos;
    }

    if (initializedSnapshot.val() === true) {
      saveLocal([]);
      return [];
    }

    const localTodos = loadLocal();
    if (localTodos && localTodos.length > 0) {
      await saveAll(localTodos);
      return localTodos;
    }

    return null;
  } catch (error) {
    console.warn(
      "Realtime Database를 불러오지 못해 브라우저 저장소를 사용합니다.",
      error,
    );
    return loadLocal();
  }
}

async function saveAll(todos) {
  saveLocal(todos);
  const value = {};
  todos.forEach((todo) => {
    value[String(todo.id)] = todoData(todo);
  });

  try {
    await withTimeout(
      Promise.all([set(todosRef, value), set(initializedRef, true)]),
      "Realtime Database 저장 시간이 초과되었습니다.",
    );
    return true;
  } catch (error) {
    console.warn(
      "Realtime Database 저장에 실패했습니다. 데이터는 이 브라우저에 보관됩니다.",
      error,
    );
    return false;
  }
}

async function saveTodo(todo) {
  saveOneLocal(todo);

  try {
    await withTimeout(
      Promise.all([
        set(child(todosRef, String(todo.id)), todoData(todo)),
        set(initializedRef, true),
      ]),
      "할 일 저장 시간이 초과되었습니다.",
    );
    return true;
  } catch (error) {
    console.warn("할 일을 Firebase에 저장하지 못했습니다.", error);
    return false;
  }
}

async function removeTodo(id) {
  removeOneLocal(id);

  try {
    await withTimeout(
      remove(child(todosRef, String(id))),
      "할 일 삭제 시간이 초과되었습니다.",
    );
    return true;
  } catch (error) {
    console.warn("할 일을 Firebase에서 삭제하지 못했습니다.", error);
    return false;
  }
}

function subscribe(onTodos, onConnectionChange) {
  const stopTodos = onValue(
    todosRef,
    (snapshot) => {
      const remoteTodos = snapshotToTodos(snapshot);
      saveLocal(remoteTodos);
      onTodos(remoteTodos);
    },
    (error) => {
      console.warn("실시간 할 일 구독에 실패했습니다.", error);
      if (onConnectionChange) onConnectionChange(false);
    },
  );

  const stopConnection = onValue(connectionRef, (snapshot) => {
    if (onConnectionChange) onConnectionChange(snapshot.val() === true);
  });

  return function unsubscribe() {
    stopTodos();
    stopConnection();
  };
}

export const TodoStore = {
  load,
  remove: removeTodo,
  save: saveTodo,
  saveAll,
  subscribe,
};

// src/lib/api.ts
// Supabase와 통신하는 코드는 전부 이 파일에만 둔다.
// 화면(컴포넌트)은 여기 함수만 호출 → 나중에 Spring으로 옮길 때 이 파일만 fetch로 바꾸면 됨.
// const API_URL = import.meta.env.VITE_API_URL as string;
// const TOKEN_KEY = "coffee_order_token";
// 🥕  ① 맨 위: API_URL, TOKEN_KEY 두 줄을 이걸로 교체
// 브라우저는 항상 프론트와 같은 주소의 /api 로 요청한다.
// 개발: Vite 프록시(vite.config.ts) / 배포: Vercel rewrite(vercel.json)가 백엔드로 전달
const API_URL = "/api";

// ───────────── 타입 ─────────────
export type MenuItem = { id: string; name: string };
export type PublicMember = {
  id: string;
  display_name: string;
  has_pin: boolean;
};
export type PublicEvent = {
  id: string;
  title: string;
  store_name: string | null;
  closed: boolean;
  members: PublicMember[];
  menu: MenuItem[];
};
export type Order = {
  first_choice: string;
  alt_choice: string | null;
  memo: string | null;
};
export type OrderInput = { first: string; alt?: string | null; memo?: string };
// 추가
export type EventSummary = {
  id: string;
  title: string;
  store_name: string | null;
  closed_at: string | null;
  created_at: string;
};
export type CurrentUser = { id: string; email: string; name: string | null };

// DashboardRow는 기존 것을 타입 영역으로 옮기기만 하면 됨 (내용 동일)
export type DashboardRow = {
  id: string;
  display_name: string;
  has_pin: boolean;
  locked: boolean;
  order: Order | null; // null이면 미응답
};

/** RPC가 돌려주는 실패 코드 */
export type RpcError =
  | "invalid_pin_format"
  | "not_found"
  | "closed"
  | "invalid_menu"
  | "wrong_pin"
  | "locked"
  | "unset";

export const ERROR_MESSAGE: Record<RpcError, string> = {
  invalid_pin_format: "PIN은 숫자 4자리여야 해요.",
  not_found: "명단에서 찾을 수 없어요.",
  closed: "마감된 주문이에요. 총대에게 문의하세요.",
  invalid_menu: "선택할 수 없는 메뉴예요.",
  wrong_pin: "PIN이 일치하지 않아요.",
  locked: "PIN을 5번 틀려서 잠겼어요. 총대에게 초기화를 요청하세요.",
  unset: "아직 PIN을 설정하지 않았어요.",
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: RpcError };

// ───────────── 공통: 요청 보내기 ─────────────
/** HTTP 실패. code에는 서버가 준 실패 코드가 들어간다 (없으면 undefined) */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(code ?? `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

const isRpcError = (code: unknown): code is RpcError =>
  typeof code === "string" && code in ERROR_MESSAGE;

/** 서버 응답 본문에서 실패 코드를 꺼낸다.
 *  업무 규칙 실패: { error: "wrong_pin" } / 입력 검증 실패: { message: ["invalid_pin_format"] } */
function extractCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const { error, message } = body as { error?: unknown; message?: unknown };
  const candidates = [error, ...(Array.isArray(message) ? message : [message])];
  return (
    candidates.find(isRpcError) ??
    (typeof error === "string" ? error : undefined)
  );
}

// 🥕 ② request 함수: 아래 두 줄 삭제 (쿠키는 브라우저가 알아서 붙인다)
//   const token = getToken();
//   if (options.auth && token) headers["Authorization"] = `Bearer ${token}`;
async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  // const token = getToken();
  // if (options.auth && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  // 로그인이 필요한 요청에서 401 = 토큰 만료/무효 → 로그아웃 처리
  // (참여자 API의 401은 "PIN 틀림"이라 여기에 해당하지 않는다)
  // if (res.status === 401 && options.auth) setToken(null);
  // 🥕 ③ request 함수: setToken(null) → notifyAuth(false)
  if (res.status === 401 && options.auth) notifyAuth(false);

  const body: unknown = await res.json().catch(() => null);
  throw new ApiError(res.status, extractCode(body));
}

/** 업무 규칙 실패는 예외 대신 { ok: false, error }로 바꿔서 화면에 넘긴다 */
function toFailure(e: unknown): { ok: false; error: RpcError } {
  if (e instanceof ApiError && isRpcError(e.code)) {
    return { ok: false, error: e.code };
  }
  throw e;
}

// ───────────── 총대: 로그인 ─────────────
const authListeners = new Set<(loggedIn: boolean) => void>();

// 🥕 ④ getToken, setToken, signInWithGoogle, completeLogin, signOut 을 전부 지우고 이걸로 교체
function notifyAuth(loggedIn: boolean) {
  authListeners.forEach((listener) => listener(loggedIn));
}

// function getToken(): string | null {
//   try {
//     return localStorage.getItem(TOKEN_KEY);
//   } catch {
//     return null;
//   }
// }

// function setToken(token: string | null) {
//   try {
//     if (token) localStorage.setItem(TOKEN_KEY, token);
//     else localStorage.removeItem(TOKEN_KEY);
//   } catch {
//     // 저장소를 못 쓰는 환경이면 로그인 상태가 유지되지 않을 뿐
//   }
//   authListeners.forEach((listener) => listener(!!token));
// }

// /** 백엔드의 로그인 시작 주소로 이동 → Google → 백엔드 → /auth/callback#token=... 으로 돌아온다 */
// export async function signInWithGoogle() {
//   window.location.href = `${API_URL}/auth/google`;
// }

// /** /auth/callback 페이지에서 호출: 주소의 #token=... 을 저장한다. 성공하면 true */
// export function completeLogin(): boolean {
//   const params = new URLSearchParams(window.location.hash.slice(1));
//   const token = params.get("token");
//   if (!token) return false;
//   setToken(token);
//   return true;
// }

// export async function signOut() {
//   setToken(null);
// }

/** 백엔드의 로그인 시작 주소로 이동 → Google → 백엔드가 세션 쿠키를 심고 홈(/)으로 돌려보낸다 */
export async function signInWithGoogle() {
  window.location.href = `${API_URL}/auth/google`;
}

export async function signOut() {
  await request("POST", "/auth/logout"); // 서버가 세션 쿠키를 지운다
  notifyAuth(false);
}

/** 현재 로그인한 총대 (없으면 null) */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // 🥕 getCurrentUser에서는 첫 줄 if (!getToken()) r됨turn null;만 지우면 됨
  // if (!getToken()) return null;
  try {
    return await request<CurrentUser>("GET", "/auth/me", { auth: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** 로그인/로그아웃 변화를 구독. 반환된 함수를 호출하면 구독 해제 (useEffect cleanup용) */
export function onAuthChange(callback: (loggedIn: boolean) => void) {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

// ───────────── 총대: 이벤트 ─────────────
/** 이벤트 + 명단 + 메뉴를 한 번에 생성. 새 이벤트 id 반환 */
export async function createEvent(input: {
  title: string;
  storeName: string;
  members: string[]; // textarea를 줄바꿈으로 split한 배열 (빈 줄은 서버가 걸러줌)
  menus: string[];
}): Promise<string> {
  const { id } = await request<{ id: string }>("POST", "/events", {
    auth: true,
    body: input,
  });
  return id;
}

export function listMyEvents() {
  return request<EventSummary[]>("GET", "/events", { auth: true });
}

/** 대시보드에 필요한 데이터 전부. 요약 카드/미응답자/메뉴별 집계는 이 결과로 프론트에서 계산 */
export function getDashboard(eventId: string) {
  return request<{
    event: Omit<EventSummary, "created_at">;
    menu: MenuItem[];
    rows: DashboardRow[];
  }>("GET", `/events/${eventId}/dashboard`, { auth: true });
}

/** 마감 / 마감 취소 */
export async function setEventClosed(eventId: string, closed: boolean) {
  await request("PATCH", `/events/${eventId}`, {
    auth: true,
    body: { closed },
  });
}

/** 대리 입력/수정 (연필 아이콘 모달). 마감 후에도 총대는 가능 */
export async function saveOrderAsOwner(memberId: string, order: OrderInput) {
  await request("PUT", `/owner/members/${memberId}/order`, {
    auth: true,
    body: { first: order.first, alt: order.alt ?? null, memo: order.memo },
  });
}

/** PIN 초기화 (잠금도 같이 풀림). 그 사람은 다음 제출 때 새 PIN을 설정하게 됨 */
export async function resetPin(memberId: string) {
  await request("DELETE", `/owner/members/${memberId}/pin`, { auth: true });
}

// ───────────── 참여자 (비로그인) ─────────────
/** 참여자 링크 진입 시: 이벤트 정보 + 명단(자동완성용) + 메뉴. 없는 이벤트면 null */
export async function getEventPublic(
  eventId: string,
): Promise<PublicEvent | null> {
  try {
    return await request<PublicEvent>("GET", `/events/${eventId}/public`);
  } catch (e) {
    // 없는 이벤트(404)이거나 주소의 id 형식이 잘못된 경우(400)
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
      return null;
    }
    throw e;
  }
}

/** 재방문자(has_pin === true)의 PIN 입력 확인 + 기존 주문 불러오기 */
export async function getMyOrder(
  memberId: string,
  pin: string,
): Promise<Result<{ closed: boolean; order: Order | null }>> {
  try {
    const data = await request<{ closed: boolean; order: Order | null }>(
      "POST",
      `/members/${memberId}/order/verify`,
      { body: { pin } },
    );
    return { ok: true, ...data };
  } catch (e) {
    return toFailure(e);
  }
}

/** 주문 제출/수정. 최초 제출이면 이때 넘긴 PIN이 그 사람의 PIN으로 설정됨 */
export async function submitOrder(
  memberId: string,
  pin: string,
  order: OrderInput,
): Promise<Result> {
  try {
    await request("PUT", `/members/${memberId}/order`, {
      body: {
        pin,
        first: order.first,
        alt: order.alt ?? null,
        memo: order.memo ?? "",
      },
    });
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

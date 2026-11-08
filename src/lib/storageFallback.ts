/**
 * 브라우저가 사이트 데이터 저장을 막으면(쿠키·사이트 데이터 차단, 기관 보안 정책) localStorage·sessionStorage 를
 * 읽기만 해도 오류가 난다. 로그인 클라이언트(Lovable 이 만드는 파일)는 불러와지는 순간 저장소를 읽으므로, 그대로면
 * 앱 전체가 안내 없이 빈 화면이 된다. main.tsx 가 앱보다 먼저 이 모듈을 불러와, 막혀 있으면 이번 방문 동안만 쓰는
 * 메모리 저장소를 대신 깔아 둔다 (이 모듈은 아무것도 불러오지 않아 가장 먼저 실행된다).
 */
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => (data.has(String(key)) ? (data.get(String(key)) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(String(key), String(value));
    },
    removeItem: (key: string) => {
      data.delete(String(key));
    },
    clear: () => data.clear(),
  };
  return storage as Storage;
}

type StorageName = "localStorage" | "sessionStorage";

/** 막힌 저장소를 메모리 저장소로 바꾸고, 바꾼 이름을 돌려준다 (쓸 수 있는 저장소는 그대로 둔다). */
export function installStorageFallback(target: Window = window): StorageName[] {
  const replaced: StorageName[] = [];
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      target[name].getItem("__storage_probe__");
    } catch {
      try {
        Object.defineProperty(target, name, { value: createMemoryStorage(), configurable: true });
        replaced.push(name);
      } catch {
        /* 바꿀 수 없는 브라우저: 앱 코드의 try 가 그대로 막아 준다 */
      }
    }
  }
  return replaced;
}

if (typeof window !== "undefined") installStorageFallback();

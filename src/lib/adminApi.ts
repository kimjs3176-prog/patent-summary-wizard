/** 관리자 API(manage-featured-patents) 응답. success·error 말고는 작업마다 다르므로 쓰는 곳에서 형태를 정한다 */
export interface AdminApiResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export type AdminApiCall = (action: string, data?: Record<string, unknown>) => Promise<AdminApiResponse>;

/**
 * Server Action の戻り値の形。
 *
 * "use server" のファイルは async 関数しか export できないため、
 * 型と初期値はこちらに置いてサーバー・クライアント双方から読む。
 */
export type ActionState = { error: string | null };

export const initialActionState: ActionState = { error: null };

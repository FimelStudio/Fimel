import type { Release } from './model';

// Version labels become part of immutable public object paths after publication.
export const RELEASE_LABEL_PATTERN = '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,79}$';
export const RELEASE_LABEL_HINT = '1-80 个字符，以英文字母或数字开头，只能包含英文字母、数字及 . _ + -。';
const releaseLabelPattern = new RegExp(RELEASE_LABEL_PATTERN);

export function releaseLabelError(label: string, status: Release['status']): string | null {
  if (label === '') return status === 'released' ? '已发行版本必须填写版本号。' : null;
  return releaseLabelPattern.test(label) ? null : `版本号格式不正确：${RELEASE_LABEL_HINT}`;
}

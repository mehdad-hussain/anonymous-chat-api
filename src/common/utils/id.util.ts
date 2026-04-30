import { nanoid } from 'nanoid';

export const genUserId = () => `usr_${nanoid(8)}`;
export const genRoomId = () => `room_${nanoid(8)}`;
export const genMsgId = () => `msg_${nanoid(8)}`;
export const genSessionToken = () => nanoid(48);

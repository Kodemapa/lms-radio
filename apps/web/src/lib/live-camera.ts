import { type IceServer } from '@obgyn/types';

/**
 * Live exam camera (WebRTC). The learner's browser streams straight to each proctor's
 * browser; our API only passes one offer and one answer between them. Offers and
 * answers carry all network candidates, so no further messages are needed.
 */

/** Random id for a dashboard tab or an exam page load (letters and digits only). */
export function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resolves once the connection has gathered its network candidates (or after `timeoutMs`). */
export function gatheredDescription(pc: RTCPeerConnection, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve) => {
    const done = () => resolve(pc.localDescription?.sdp ?? '');
    if (pc.iceGatheringState === 'complete') return done();
    const timer = window.setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer);
        done();
      }
    });
  });
}

export function newPeerConnection(iceServers: IceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] });
}

/** Proctor side: an offer to receive one learner's camera. */
export async function createViewerOffer(iceServers: IceServer[]): Promise<{ pc: RTCPeerConnection; sdp: string }> {
  const pc = newPeerConnection(iceServers);
  pc.addTransceiver('video', { direction: 'recvonly' });
  await pc.setLocalDescription(await pc.createOffer());
  return { pc, sdp: await gatheredDescription(pc) };
}

/** Learner side: answer a proctor's offer by sending the camera. */
export async function answerViewer(
  iceServers: IceServer[],
  offerSdp: string,
  stream: MediaStream,
): Promise<{ pc: RTCPeerConnection; sdp: string }> {
  const pc = newPeerConnection(iceServers);
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  for (const track of stream.getVideoTracks()) pc.addTrack(track, stream);
  await pc.setLocalDescription(await pc.createAnswer());
  return { pc, sdp: await gatheredDescription(pc) };
}

/** Camera settings for proctoring: small and smooth enough to watch, light on bandwidth. */
export const EXAM_CAMERA: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' },
};

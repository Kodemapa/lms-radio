import { Injectable } from '@nestjs/common';

/** How long an unanswered offer or an unread answer is kept. */
const TTL_MS = 2 * 60 * 1000;
/** A proctor watches many learners, but a learner never has more than this many viewers. */
const MAX_VIEWERS_PER_SESSION = 8;

interface Link {
  peerId: string;
  offer: string;
  answer: string | null;
  /** The learner page (stream epoch) that answered; a new page needs a new offer. */
  updatedAt: number;
}

/**
 * Sets up the live camera connections between a learner and each proctor watching
 * them (WebRTC, offer/answer with all ICE candidates included, so two messages
 * suffice). The video itself goes browser to browser and never passes through here.
 *
 * Kept in memory: the API runs as one process. With several instances this would move
 * to Redis pub/sub.
 */
@Injectable()
export class SignalHub {
  private readonly links = new Map<string, Map<string, Link>>();

  /** A proctor (one dashboard tab = one peerId) asks to watch a learner. Replaces its previous offer. */
  offer(sessionId: string, peerId: string, sdp: string, now = Date.now()): void {
    this.sweep(now);
    const session = this.links.get(sessionId) ?? new Map<string, Link>();
    session.set(peerId, { peerId, offer: sdp, answer: null, updatedAt: now });
    while (session.size > MAX_VIEWERS_PER_SESSION) {
      const oldest = [...session.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0]!;
      session.delete(oldest.peerId);
    }
    this.links.set(sessionId, session);
  }

  /** Offers the learner's page hasn't answered yet. */
  pendingOffers(sessionId: string, now = Date.now()): { peerId: string; sdp: string }[] {
    this.sweep(now);
    return [...(this.links.get(sessionId)?.values() ?? [])]
      .filter((link) => link.answer === null)
      .map((link) => ({ peerId: link.peerId, sdp: link.offer }));
  }

  /** The learner's page answers one proctor's offer. False if that offer is gone. */
  answer(sessionId: string, peerId: string, sdp: string, now = Date.now()): boolean {
    const link = this.links.get(sessionId)?.get(peerId);
    if (!link) return false;
    link.answer = sdp;
    link.updatedAt = now;
    return true;
  }

  /** Answers ready for one proctor, across the given sessions. Each is returned once. */
  takeAnswers(peerId: string, sessionIds: Iterable<string>, now = Date.now()): { sessionId: string; sdp: string }[] {
    this.sweep(now);
    const ready: { sessionId: string; sdp: string }[] = [];
    for (const sessionId of sessionIds) {
      const session = this.links.get(sessionId);
      const link = session?.get(peerId);
      if (link?.answer) {
        ready.push({ sessionId, sdp: link.answer });
        session!.delete(peerId);
      }
    }
    return ready;
  }

  /** The exam ended: forget its connections. */
  close(sessionId: string): void {
    this.links.delete(sessionId);
  }

  private sweep(now: number): void {
    for (const [sessionId, session] of this.links) {
      for (const [peerId, link] of session) if (now - link.updatedAt > TTL_MS) session.delete(peerId);
      if (session.size === 0) this.links.delete(sessionId);
    }
  }
}

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagerieService, DirectMessage, ConversationSummary, ChatParticipant, CallSignalPayload } from '../../services/messagerie.service';
import { topicSubjectRowFromMessage } from '../../utils/eco-topic-display';
import { AuthService, UserResponse } from '../../services/auth.service';
import { Subscription } from 'rxjs';

interface OptimisticMessage extends DirectMessage {
  tempId: string;
}

interface CallHistoryEntry {
  id: string;
  mode: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'started' | 'accepted' | 'rejected' | 'ended' | 'missed';
  at: string;
}

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messagerie.component.html',
  styleUrl: './messagerie.component.css'
})
export class MessagerieComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatScroll') private chatScrollContainer!: ElementRef;
  @ViewChild('localVideo') private localVideoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') private remoteVideoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') private remoteAudioElement?: ElementRef<HTMLAudioElement>;
  private activeConversationRequestId = 0;
  private pendingOpenConversation: ConversationSummary | null = null;
  private contactsLoadRequestId = 0;
  private conversationsLoadRequestId = 0;
  private incomingSub?: Subscription;
  private callSignalSub?: Subscription;
  private pendingOptimisticMessages: OptimisticMessage[] = [];
  private rtcPeer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private pendingOfferSdp: RTCSessionDescriptionInit | null = null;
  private offerRetryTimer: ReturnType<typeof setInterval> | null = null;
  private lastOfferTargetId: number | null = null;
  private lastOfferVideoEnabled = false;
  private offerRetryCount = 0;

  public contacts: UserResponse[] = [];
  public conversations: ConversationSummary[] = [];
  public activeContact: UserResponse | null = null;
  public messages: DirectMessage[] = [];
  public currentMessage = '';
  public myUser: UserResponse | null = null;
  public contactsLoading = false;
  public conversationsLoading = false;
  public contactsError = '';
  public conversationsError = '';
  public contactSearch = '';
  public sending = false;
  public sendError = '';
  public callError = '';
  public isCalling = false;
  public isIncomingCall = false;
  public inCall = false;
  public incomingFromUser: UserResponse | null = null;
  public callWithVideo = true;
  public remoteVideoActive = false;
  public localVideoEnabled = true;
  public callTrackInfo = '';
  public callHistory: CallHistoryEntry[] = [];

  constructor(
    private messagerieService: MessagerieService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const cachedUser = this.authService.currentUser;
    if (cachedUser) {
      this.initializeMessaging(cachedUser);
    }

    this.authService.getMe().subscribe({
      next: (u: UserResponse) => this.initializeMessaging(u),
      error: () => {
        if (!this.myUser) {
          this.conversationsLoading = false;
          this.contactsLoading = false;
          this.conversationsError = 'Unable to load conversations.';
          this.contactsError = 'Unable to load users right now.';
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.incomingSub?.unsubscribe();
    this.callSignalSub?.unsubscribe();
    this.endCurrentCall(false);
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  get filteredContacts(): UserResponse[] {
    const query = this.contactSearch.trim().toLowerCase();
    if (!query) {
      return this.contacts;
    }
    return this.contacts.filter((contact) =>
      contact.fullName.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.role.toLowerCase().includes(query)
    );
  }

  loadContacts(): void {
    const requestId = ++this.contactsLoadRequestId;
    this.contactsLoading = this.contacts.length === 0;
    this.contactsError = '';

    this.messagerieService.loadPublicUsers().subscribe({
      next: (users) => {
        if (this.contactsLoadRequestId !== requestId) {
          return;
        }
        this.contacts = users.filter(u => u.id !== this.myUser?.id);
        this.contactsLoading = false;
      },
      error: () => {
        if (this.contactsLoadRequestId !== requestId) {
          return;
        }
        this.contactsLoading = false;
        this.contactsError = 'Unable to load users right now.';
      }
    });
  }

  loadConversations(preserveSelection = true): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.conversationsLoading = this.conversations.length === 0;
    this.conversationsError = '';

    this.messagerieService.loadConversations().subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.conversations = conversations;
        this.conversationsLoading = false;

        if (!preserveSelection && this.activeContact) {
          return;
        }

        if (!this.activeContact && this.conversations.length > 0) {
          this.openConversation(this.conversations[0]);
        }
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.conversationsLoading = false;
        this.conversationsError = 'Unable to load conversations.';
      }
    });
  }

  selectContact(contact: UserResponse): void {
    this.activateConversation(contact);
  }

  openConversation(summary: ConversationSummary): void {
    const targetUser = this.resolveOtherUser(summary);
    if (!targetUser) {
      this.pendingOpenConversation = summary;
      if (!this.myUser) {
        this.authService.getMe().subscribe({
          next: (u: UserResponse) => {
            this.initializeMessaging(u);
            if (this.pendingOpenConversation) {
              const pending = this.pendingOpenConversation;
              this.pendingOpenConversation = null;
              this.openConversation(pending);
            }
          }
        });
      }
      return;
    }
    this.pendingOpenConversation = null;
    const existing = this.contacts.find(contact => contact.id === targetUser.id);
    const contact = existing ?? {
      id: targetUser.id,
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
      verified: true,
      banned: false,
      createdAt: summary.lastMessageTime
    };
    this.activateConversation(contact);
  }

  onConversationPointerDown(summary: ConversationSummary): void {
    this.openConversation(summary);
  }

  onContactPointerDown(contact: UserResponse): void {
    this.selectContact(contact);
  }

  async startAudioCall(): Promise<void> {
    await this.startCall(false);
  }

  async startVideoCall(): Promise<void> {
    await this.startCall(true);
  }

  async acceptIncomingCall(): Promise<void> {
    if (!this.incomingFromUser) return;
    this.messagerieService.silenceIncomingRing();
    this.activateConversation(this.incomingFromUser);
    await this.ensurePeerConnection();
    try {
      if (this.pendingOfferSdp) {
        await this.rtcPeer!.setRemoteDescription(new RTCSessionDescription(this.pendingOfferSdp));
      }
      await this.ensureLocalMedia(this.callWithVideo);
      const answer = await this.rtcPeer!.createAnswer();
      await this.rtcPeer!.setLocalDescription(answer);
      this.messagerieService.sendCallSignal({
        type: 'call-answer',
        toUserId: this.incomingFromUser.id,
        sdp: answer,
        videoEnabled: this.callWithVideo
      });
      this.isIncomingCall = false;
      this.inCall = true;
      this.callError = '';
      this.pushCallHistory('incoming', this.callWithVideo ? 'video' : 'audio', 'accepted');
    } catch {
      this.callError = 'Impossible d’accepter l’appel.';
      this.rejectIncomingCall();
    }
  }

  rejectIncomingCall(): void {
    if (!this.incomingFromUser) return;
    this.messagerieService.silenceIncomingRing();
    this.messagerieService.sendCallSignal({
      type: 'call-reject',
      toUserId: this.incomingFromUser.id
    });
    this.isIncomingCall = false;
    this.incomingFromUser = null;
    this.pushCallHistory('incoming', this.callWithVideo ? 'video' : 'audio', 'rejected');
  }

  hangupCall(): void {
    this.messagerieService.silenceIncomingRing();
    const target = this.activeContact;
    if (target) {
      this.messagerieService.sendCallSignal({
        type: 'call-end',
        toUserId: target.id
      });
    }
    this.pushCallHistory('outgoing', this.callWithVideo ? 'video' : 'audio', 'ended');
    this.endCurrentCall(true);
  }

  async toggleLocalCamera(): Promise<void> {
    const track = this.localStream?.getVideoTracks()?.[0];
    if (!track) {
      this.callError = 'Caméra indisponible pour cet appel.';
      return;
    }
    track.enabled = !track.enabled;
    this.localVideoEnabled = track.enabled;
  }

  sendMessage(): void {
    if (this.sending) return;
    if (!this.currentMessage.trim() || !this.activeContact || !this.myUser) return;

    const content = this.currentMessage.trim();
    const target = this.activeContact;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const optimistic: OptimisticMessage = {
      tempId,
      sender: {
        id: this.myUser.id,
        fullName: this.myUser.fullName,
        email: this.myUser.email,
        role: this.myUser.role as 'USER' | 'ADMIN' | 'PARTNER'
      },
      receiver: {
        id: target.id,
        fullName: target.fullName,
        email: target.email,
        role: target.role as 'USER' | 'ADMIN' | 'PARTNER'
      },
      content,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    this.pendingOptimisticMessages = [...this.pendingOptimisticMessages, optimistic];
    this.messages = this.mergeWithPending(this.messages);

    this.sending = true;
    this.sendError = '';
    this.currentMessage = '';

    this.messagerieService.sendMessage(target.id, content).subscribe({
      next: () => {
        this.sending = false;
        // Real message will arrive via WS echo; nothing else to do here.
      },
      error: () => {
        this.sending = false;
        this.sendError = 'Message failed to send.';
        // Remove the failed optimistic entry so the user knows it didn't go through.
        this.pendingOptimisticMessages = this.pendingOptimisticMessages.filter(p => p.tempId !== tempId);
        this.messages = this.mergeWithPending(this.messages.filter(m => (m as OptimisticMessage).tempId !== tempId));
        this.currentMessage = content;
      }
    });
  }

  initials(name: string | undefined): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  isMine(message: DirectMessage): boolean {
    return message.sender.id === this.myUser?.id;
  }

  /** Bandeau sujet (backend ou inférence locale si l’IA n’a pas tagué). */
  topicSubjectRow(msg: DirectMessage) {
    return topicSubjectRowFromMessage(msg);
  }

  previewName(conversation: ConversationSummary): string {
    return conversation.otherUser?.fullName || `${conversation.userA.fullName} & ${conversation.userB.fullName}`;
  }

  trackConversation(_: number, conversation: ConversationSummary): string {
    return conversation.conversationKey;
  }

  trackContact(_: number, contact: UserResponse): number {
    return contact.id;
  }

  conversationTargetId(conversation: ConversationSummary): number | null {
    return this.resolveOtherUser(conversation)?.id ?? null;
  }

  private resolveOtherUser(summary: ConversationSummary): ChatParticipant | null {
    if (summary.otherUser) {
      return summary.otherUser;
    }
    if (!this.myUser) {
      return null;
    }

    if (summary.userA.id === this.myUser.id) {
      return summary.userB;
    }
    if (summary.userB.id === this.myUser.id) {
      return summary.userA;
    }

    return null;
  }

  private scrollToBottom(): void {
    try {
      this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
    } catch { }
  }

  private initializeMessaging(user: UserResponse): void {
    const isSameUser = this.myUser?.id === user.id;
    this.myUser = user;

    if (!isSameUser) {
      this.messagerieService.connect(this.myUser.id, this.myUser.role === 'ADMIN');
      this.loadContacts();
      this.loadConversations();
    }

    if (!this.incomingSub) {
      this.incomingSub = this.messagerieService.incomingMessage$.subscribe((msg) => {
        if (!msg || !this.myUser) {
          return;
        }
        const belongsToActiveThread = this.activeContact != null &&
          ((msg.sender.id === this.myUser.id && msg.receiver.id === this.activeContact.id) ||
            (msg.sender.id === this.activeContact.id && msg.receiver.id === this.myUser.id));

        if (belongsToActiveThread) {
          this.appendIncoming(msg);
        }
        // Any incoming message may change the conversations sidebar; refresh once.
        this.loadConversations(false);
      });
    }

    if (!this.callSignalSub) {
      this.callSignalSub = this.messagerieService.callSignal$.subscribe((signal) => {
        void this.handleCallSignal(signal);
      });
    }
  }

  private activateConversation(contact: UserResponse): void {
    this.activeContact = contact;
    this.pendingOptimisticMessages = [];
    this.messages = [];
    this.callHistory = this.readCallHistory(contact.id);
    this.refreshActiveConversation();
  }

  private refreshActiveConversation(): void {
    if (!this.activeContact) {
      return;
    }
    const contactId = this.activeContact.id;
    const requestId = ++this.activeConversationRequestId;
    this.messagerieService.loadHistory(contactId).subscribe({
      next: (msgs) => {
        if (this.activeContact?.id !== contactId || this.activeConversationRequestId !== requestId) {
          return;
        }
        this.messages = this.mergeWithPending(msgs);
      },
      error: () => {
        if (this.activeContact?.id !== contactId || this.activeConversationRequestId !== requestId) {
          return;
        }
        this.messages = [];
      }
    });
  }

  // Append an incoming WS message to the active thread, replacing any matching optimistic entry.
  private appendIncoming(msg: DirectMessage): void {
    // Drop the first pending optimistic that matches sender/receiver/content (FIFO order).
    if (msg.sender.id === this.myUser?.id) {
      const idx = this.pendingOptimisticMessages.findIndex(p =>
        p.receiver.id === msg.receiver.id && p.content === msg.content);
      if (idx >= 0) {
        this.pendingOptimisticMessages.splice(idx, 1);
      }
    }
    // Avoid duplicating if we already have this server id (e.g. sender+receiver both on same client).
    if (msg.id != null && this.messages.some(m => m.id === msg.id)) {
      this.messages = this.mergeWithPending(this.messages);
      return;
    }
    const base = this.messages.filter(m => !(m as OptimisticMessage).tempId);
    this.messages = this.mergeWithPending([...base, msg]);
  }

  private mergeWithPending(serverMessages: DirectMessage[]): DirectMessage[] {
    // Drop stale optimistic entries older than 20 s (they're probably duplicates the server already sent back).
    this.pendingOptimisticMessages = this.pendingOptimisticMessages.filter((pending) => {
      const ageMs = Date.now() - new Date(pending.timestamp).getTime();
      return ageMs < 20000;
    });

    if (!this.pendingOptimisticMessages.length) {
      return serverMessages;
    }
    return [...serverMessages, ...this.pendingOptimisticMessages];
  }

  private async startCall(videoEnabled: boolean): Promise<void> {
    if (!this.activeContact || !this.myUser) {
      this.callError = 'Sélectionne un utilisateur avant de lancer un appel.';
      return;
    }
    this.callError = '';
    this.callWithVideo = videoEnabled;
    this.isCalling = true;
    try {
      await this.ensurePeerConnection();
      await this.ensureLocalMedia(videoEnabled);
      const offer = await this.rtcPeer!.createOffer();
      await this.rtcPeer!.setLocalDescription(offer);
      this.lastOfferTargetId = this.activeContact.id;
      this.lastOfferVideoEnabled = videoEnabled;
      this.sendOfferSignal(offer);
      this.startOfferRetryLoop();
      this.pushCallHistory('outgoing', videoEnabled ? 'video' : 'audio', 'started');
    } catch {
      this.callError = 'Impossible de démarrer l’appel. Vérifie micro/caméra.';
      this.endCurrentCall(false);
    }
  }

  private async handleCallSignal(signal: CallSignalPayload): Promise<void> {
    if (!this.myUser || signal.toUserId !== this.myUser.id) return;
    let fromUser = this.contacts.find((u) => u.id === signal.fromUserId)
      || this.conversations.map((c) => this.resolveOtherUser(c)).find((u) => u?.id === signal.fromUserId)
      || (this.activeContact?.id === signal.fromUserId ? this.activeContact : null)
      || {
        id: signal.fromUserId,
        fullName: `User #${signal.fromUserId}`,
        email: '',
        role: 'USER',
        verified: true,
        banned: false
      } as UserResponse;

    if (fromUser.fullName.startsWith('User #')) {
      this.messagerieService.loadPublicUsers().subscribe({
        next: (users) => {
          const resolved = users.find((u) => u.id === signal.fromUserId);
          if (resolved && this.incomingFromUser?.id === signal.fromUserId) {
            this.incomingFromUser = resolved;
          }
        },
        error: () => {}
      });
    }

    if (signal.type === 'call-offer') {
      this.activateConversation(fromUser as UserResponse);
      this.callWithVideo = !!signal.videoEnabled;
      this.pendingOfferSdp = signal.sdp ?? null;
      this.incomingFromUser = fromUser as UserResponse;
      this.isIncomingCall = true;
      this.isCalling = false;
      this.callError = '';
      this.pushCallHistory('incoming', this.callWithVideo ? 'video' : 'audio', 'started');
      return;
    }

    if (!this.activeContact || fromUser.id !== this.activeContact.id || !this.rtcPeer) return;
    if (signal.type === 'call-answer' && signal.sdp) {
      await this.rtcPeer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      for (const c of this.pendingRemoteCandidates) {
        await this.rtcPeer.addIceCandidate(new RTCIceCandidate(c));
      }
      this.pendingRemoteCandidates = [];
      this.attachRemoteVideo();
      this.inCall = true;
      this.isCalling = false;
      this.stopOfferRetryLoop();
      this.pushCallHistory('outgoing', this.callWithVideo ? 'video' : 'audio', 'accepted');
      return;
    }
    if (signal.type === 'ice-candidate' && signal.candidate) {
      if (this.rtcPeer.remoteDescription) {
        await this.rtcPeer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        this.pendingRemoteCandidates.push(signal.candidate);
      }
      return;
    }
    if (signal.type === 'call-reject') {
      this.callError = 'Appel refusé.';
      this.stopOfferRetryLoop();
      this.pushCallHistory('outgoing', this.callWithVideo ? 'video' : 'audio', 'rejected');
      this.endCurrentCall(false);
      return;
    }
    if (signal.type === 'call-end') {
      this.stopOfferRetryLoop();
      this.pushCallHistory('incoming', this.callWithVideo ? 'video' : 'audio', 'ended');
      this.endCurrentCall(true);
    }
  }

  private async ensurePeerConnection(): Promise<void> {
    if (this.rtcPeer) return;
    this.rtcPeer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    this.rtcPeer.onicecandidate = (event) => {
      if (!event.candidate || !this.activeContact) return;
      this.messagerieService.sendCallSignal({
        type: 'ice-candidate',
        toUserId: this.activeContact.id,
        candidate: event.candidate.toJSON()
      });
    };
    this.rtcPeer.ontrack = (event) => {
      const trackKind = event.track?.kind || 'unknown';
      console.info('[Call] remote track received:', trackKind);
      this.callTrackInfo = `remote:${trackKind}`;
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (event.track) {
        this.remoteStream.addTrack(event.track);
      }
      this.attachRemoteVideo();
      this.remoteVideoActive = this.remoteStream.getVideoTracks().some((t) => t.readyState === 'live');
      this.inCall = true;
      this.isCalling = false;
    };
    this.rtcPeer.oniceconnectionstatechange = () => {
      const state = this.rtcPeer?.iceConnectionState;
      console.info('[Call] ICE state:', state);
      if (state === 'connected' || state === 'completed') {
        this.attachRemoteVideo();
      }
    };
    this.rtcPeer.onconnectionstatechange = () => {
      if (!this.rtcPeer) return;
      if (this.rtcPeer.connectionState === 'failed' || this.rtcPeer.connectionState === 'disconnected') {
        this.endCurrentCall(true);
      }
    };
  }

  private async ensureLocalMedia(video: boolean): Promise<void> {
    if (this.localStream) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });
    for (const track of this.localStream.getTracks()) {
      this.rtcPeer?.addTrack(track, this.localStream);
    }
    this.localVideoEnabled = this.localStream.getVideoTracks().some((t) => t.enabled);
    if (this.localVideoElement?.nativeElement) {
      this.localVideoElement.nativeElement.srcObject = this.localStream;
      this.localVideoElement.nativeElement.muted = true;
    }
  }

  onRemoteVideoReady(): void {
    const hasVideo = !!this.remoteStream?.getVideoTracks()?.length;
    this.remoteVideoActive = hasVideo;
  }

  private attachRemoteVideo(): void {
    if (!this.remoteStream) {
      return;
    }
    if (this.remoteVideoElement?.nativeElement) {
      this.remoteVideoElement.nativeElement.srcObject = this.remoteStream;
    }
    if (this.remoteAudioElement?.nativeElement) {
      this.remoteAudioElement.nativeElement.srcObject = this.remoteStream;
    }
  }

  private endCurrentCall(clearError: boolean): void {
    this.messagerieService.silenceIncomingRing();
    this.isCalling = false;
    this.isIncomingCall = false;
    this.inCall = false;
    this.incomingFromUser = null;
    this.pendingRemoteCandidates = [];
    this.pendingOfferSdp = null;
    this.stopOfferRetryLoop();
    this.lastOfferTargetId = null;
    this.offerRetryCount = 0;
    this.remoteVideoActive = false;
    this.localVideoEnabled = true;
    this.callTrackInfo = '';
    if (clearError) {
      this.callError = '';
    }
    if (this.rtcPeer) {
      this.rtcPeer.close();
      this.rtcPeer = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
    if (this.localVideoElement?.nativeElement) {
      this.localVideoElement.nativeElement.srcObject = null;
    }
    if (this.remoteVideoElement?.nativeElement) {
      this.remoteVideoElement.nativeElement.srcObject = null;
    }
    if (this.remoteAudioElement?.nativeElement) {
      this.remoteAudioElement.nativeElement.srcObject = null;
    }
  }

  private sendOfferSignal(offer: RTCSessionDescriptionInit): void {
    if (this.lastOfferTargetId == null) return;
    this.messagerieService.sendCallSignal({
      type: 'call-offer',
      toUserId: this.lastOfferTargetId,
      sdp: offer,
      videoEnabled: this.lastOfferVideoEnabled
    });
  }

  private startOfferRetryLoop(): void {
    this.stopOfferRetryLoop();
    this.offerRetryCount = 0;
    this.offerRetryTimer = setInterval(() => {
      if (!this.isCalling || this.inCall || !this.rtcPeer?.localDescription || this.lastOfferTargetId == null) {
        this.stopOfferRetryLoop();
        return;
      }
      this.offerRetryCount += 1;
      if (this.offerRetryCount > 6) {
        this.stopOfferRetryLoop();
        return;
      }
      this.sendOfferSignal(this.rtcPeer.localDescription);
    }, 1200);
  }

  private stopOfferRetryLoop(): void {
    if (this.offerRetryTimer) {
      clearInterval(this.offerRetryTimer);
      this.offerRetryTimer = null;
    }
  }

  callHistoryLabel(item: CallHistoryEntry): string {
    const mode = item.mode === 'video' ? 'Video' : 'Audio';
    const side = item.direction === 'incoming' ? 'Incoming' : 'Outgoing';
    const status = item.status.charAt(0).toUpperCase() + item.status.slice(1);
    return `${side} ${mode} • ${status}`;
  }

  private historyStorageKey(contactId: number): string {
    const me = this.myUser?.id ?? 0;
    const a = Math.min(me, contactId);
    const b = Math.max(me, contactId);
    return `vero_call_history_${a}_${b}`;
  }

  private readCallHistory(contactId: number): CallHistoryEntry[] {
    try {
      const raw = localStorage.getItem(this.historyStorageKey(contactId));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private pushCallHistory(direction: 'incoming' | 'outgoing', mode: 'audio' | 'video', status: CallHistoryEntry['status']): void {
    const contactId = this.activeContact?.id;
    if (!contactId) return;
    const next: CallHistoryEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      direction,
      mode,
      status,
      at: new Date().toISOString()
    };
    const updated = [next, ...this.readCallHistory(contactId)].slice(0, 20);
    localStorage.setItem(this.historyStorageKey(contactId), JSON.stringify(updated));
    this.callHistory = updated;
  }
}

import { BaseEntity, Status } from './common';

export interface Conversation extends BaseEntity {
  sessionId: string;
  agentId: string;
  userId?: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  metadata: ConversationMetadata;
  messages: Message[];
  tags: string[];
  assignedTo?: string;
  rating?: ConversationRating;
  resolution?: ConversationResolution;
  organizationId: string;
}

export type ConversationChannel = 
  | 'whatsapp' 
  | 'telegram' 
  | 'facebook' 
  | 'instagram' 
  | 'webchat' 
  | 'api'
  | 'email'
  | 'sms'
  | 'voice';

export type ConversationStatus = 
  | 'active' 
  | 'waiting' 
  | 'resolved' 
  | 'transferred' 
  | 'abandoned'
  | 'archived';

export interface ConversationMetadata {
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  messageCount: number;
  language: string;
  country?: string;
  device?: string;
  userAgent?: string;
  referrer?: string;
  customFields: Record<string, any>;
}

export interface Message extends BaseEntity {
  conversationId: string;
  type: MessageType;
  direction: MessageDirection;
  content: MessageContent;
  sender: MessageSender;
  status: MessageStatus;
  metadata: MessageMetadata;
}

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'audio' 
  | 'video' 
  | 'file' 
  | 'location'
  | 'contact'
  | 'sticker'
  | 'quick_reply'
  | 'button'
  | 'card';

export type MessageDirection = 'inbound' | 'outbound';

export interface MessageContent {
  text?: string;
  media?: MediaContent;
  location?: LocationContent;
  contact?: ContactContent;
  interactive?: InteractiveContent;
  raw?: any;
}

export interface MediaContent {
  url: string;
  mimeType: string;
  size: number;
  filename?: string;
  caption?: string;
  thumbnail?: string;
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactContent {
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
}

export interface InteractiveContent {
  type: 'quick_reply' | 'button' | 'list' | 'card';
  title?: string;
  subtitle?: string;
  options: InteractiveOption[];
}

export interface InteractiveOption {
  id: string;
  title: string;
  description?: string;
  payload?: string;
}

export interface MessageSender {
  id: string;
  name?: string;
  type: 'user' | 'agent' | 'system';
  avatar?: string;
}

export type MessageStatus = 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed' 
  | 'pending';

export interface MessageMetadata {
  platform?: string;
  platformMessageId?: string;
  processedAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  intent?: DialogflowIntent;
  entities?: DialogflowEntity[];
  sentiment?: SentimentAnalysis;
  languageDetection?: LanguageDetection;
}

export interface DialogflowIntent {
  name: string;
  displayName: string;
  confidence: number;
  parameters: Record<string, any>;
}

export interface DialogflowEntity {
  entity: string;
  value: string;
  confidence: number;
}

export interface SentimentAnalysis {
  score: number;
  magnitude: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface LanguageDetection {
  language: string;
  confidence: number;
}

export interface ConversationRating {
  score: number;
  comment?: string;
  ratedAt: Date;
  ratedBy: string;
}

export interface ConversationResolution {
  type: 'resolved' | 'transferred' | 'escalated';
  reason?: string;
  resolvedAt: Date;
  resolvedBy: string;
  notes?: string;
}
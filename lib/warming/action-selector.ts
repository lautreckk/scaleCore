interface WarmingConfig {
  text_messages_enabled: boolean;
  text_messages_weight: number;
  audio_messages_enabled: boolean;
  audio_messages_weight: number;
  image_messages_enabled: boolean;
  image_messages_weight: number;
  document_messages_enabled: boolean;
  document_messages_weight: number;
  video_messages_enabled: boolean;
  video_messages_weight: number;
  status_posts_enabled: boolean;
  status_posts_weight: number;
  status_views_enabled: boolean;
  status_views_weight: number;
  reactions_enabled: boolean;
  reactions_weight: number;
  max_messages_per_day: number;
  max_audio_per_day: number;
  max_media_per_day: number;
  max_status_per_day: number;
  max_reactions_per_day: number;
}

interface WarmingConfigInstance {
  messages_sent_today: number;
  audio_sent_today: number;
  media_sent_today: number;
  status_posted_today: number;
  reactions_sent_today: number;
}

export type ActionType =
  | "text_message"
  | "audio_message"
  | "image_message"
  | "document_message"
  | "video_message"
  | "status_post"
  | "status_view"
  | "reaction";

interface ActionWeight {
  type: ActionType;
  weight: number;
  enabled: boolean;
}

export function getAvailableActions(config: WarmingConfig): ActionWeight[] {
  return [
    {
      type: "text_message",
      weight: config.text_messages_weight,
      enabled: config.text_messages_enabled,
    },
    {
      type: "audio_message",
      weight: config.audio_messages_weight,
      enabled: config.audio_messages_enabled,
    },
    {
      type: "image_message",
      weight: config.image_messages_weight,
      enabled: config.image_messages_enabled,
    },
    {
      type: "document_message",
      weight: config.document_messages_weight,
      enabled: config.document_messages_enabled,
    },
    {
      type: "video_message",
      weight: config.video_messages_weight,
      enabled: config.video_messages_enabled,
    },
    {
      type: "status_post",
      weight: config.status_posts_weight,
      enabled: config.status_posts_enabled,
    },
    {
      type: "status_view",
      weight: config.status_views_weight,
      enabled: config.status_views_enabled,
    },
    {
      type: "reaction",
      weight: config.reactions_weight,
      enabled: config.reactions_enabled,
    },
  ];
}

export function selectActionByWeight(config: WarmingConfig): ActionType | null {
  const actions = getAvailableActions(config).filter((a) => a.enabled && a.weight > 0);

  if (actions.length === 0) return null;

  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const action of actions) {
    random -= action.weight;
    if (random <= 0) {
      return action.type;
    }
  }

  return actions[0].type;
}

export function canExecuteAction(
  actionType: ActionType,
  config: WarmingConfig,
  instance: WarmingConfigInstance
): { canExecute: boolean; reason?: string } {
  // Check daily limits based on action type
  switch (actionType) {
    case "text_message":
      if (instance.messages_sent_today >= config.max_messages_per_day) {
        return {
          canExecute: false,
          reason: `Daily message limit reached (${config.max_messages_per_day})`,
        };
      }
      break;

    case "audio_message":
      if (instance.audio_sent_today >= config.max_audio_per_day) {
        return {
          canExecute: false,
          reason: `Daily audio limit reached (${config.max_audio_per_day})`,
        };
      }
      break;

    case "image_message":
    case "document_message":
    case "video_message":
      if (instance.media_sent_today >= config.max_media_per_day) {
        return {
          canExecute: false,
          reason: `Daily media limit reached (${config.max_media_per_day})`,
        };
      }
      break;

    case "status_post":
      if (instance.status_posted_today >= config.max_status_per_day) {
        return {
          canExecute: false,
          reason: `Daily status limit reached (${config.max_status_per_day})`,
        };
      }
      break;

    case "reaction":
      if (instance.reactions_sent_today >= config.max_reactions_per_day) {
        return {
          canExecute: false,
          reason: `Daily reaction limit reached (${config.max_reactions_per_day})`,
        };
      }
      break;
  }

  return { canExecute: true };
}

export function getCounterFieldForAction(
  actionType: ActionType
): keyof Pick<
  WarmingConfigInstance,
  | "messages_sent_today"
  | "audio_sent_today"
  | "media_sent_today"
  | "status_posted_today"
  | "reactions_sent_today"
> {
  switch (actionType) {
    case "text_message":
      return "messages_sent_today";
    case "audio_message":
      return "audio_sent_today";
    case "image_message":
    case "document_message":
    case "video_message":
      return "media_sent_today";
    case "status_post":
    case "status_view":
      return "status_posted_today";
    case "reaction":
      return "reactions_sent_today";
  }
}

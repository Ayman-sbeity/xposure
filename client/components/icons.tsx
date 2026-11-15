import type { ComponentType } from 'react';
import {
  ArrowDown as ArrowDownBase,
  ArrowLeft as ArrowLeftBase,
  ArrowUpRight as ArrowUpRightBase,
  Briefcase as BriefcaseBase,
  Megaphone as MegaphoneBase,
  MessageSquareText as MessageSquareTextBase,
  RotateCcw as RotateCcwBase,
  SendHorizontal as SendHorizontalBase,
  PartyPopper as PartyPopperBase,
  Sparkles as SparklesBase,
  Store as StoreBase,
  Check as CheckBase,
  ChevronLeft as ChevronLeftBase,
  ChevronRight as ChevronRightBase,
  Pause as PauseBase,
  Play as PlayBase,
  Instagram as InstagramBase,
  Linkedin as LinkedinBase,
  Mail as MailBase,
  MapPin as MapPinBase,
  Menu as MenuBase,
  MessageCircle as MessageCircleBase,
  Minus as MinusBase,
  Phone as PhoneBase,
  Plus as PlusBase,
  X as XBase,
  type LucideProps,
} from 'lucide-react';

// Icons are decorative: the surrounding link or button always carries the text.
function decorative(Icon: ComponentType<LucideProps>) {
  const Decorative = (props: LucideProps) => <Icon aria-hidden="true" focusable="false" {...props} />;
  Decorative.displayName = Icon.displayName;
  return Decorative;
}

export const ArrowDown = decorative(ArrowDownBase);
export const ArrowLeft = decorative(ArrowLeftBase);
export const ArrowUpRight = decorative(ArrowUpRightBase);
export const Briefcase = decorative(BriefcaseBase);
export const Megaphone = decorative(MegaphoneBase);
export const MessageSquareText = decorative(MessageSquareTextBase);
export const RotateCcw = decorative(RotateCcwBase);
export const SendHorizontal = decorative(SendHorizontalBase);
export const PartyPopper = decorative(PartyPopperBase);
export const Sparkles = decorative(SparklesBase);
export const Store = decorative(StoreBase);
export const Check = decorative(CheckBase);
export const ChevronLeft = decorative(ChevronLeftBase);
export const ChevronRight = decorative(ChevronRightBase);
export const Pause = decorative(PauseBase);
export const Play = decorative(PlayBase);
export const Instagram = decorative(InstagramBase);
export const Linkedin = decorative(LinkedinBase);
export const Mail = decorative(MailBase);
export const MapPin = decorative(MapPinBase);
export const Menu = decorative(MenuBase);
export const MessageCircle = decorative(MessageCircleBase);
export const Minus = decorative(MinusBase);
export const Phone = decorative(PhoneBase);
export const Plus = decorative(PlusBase);
export const Close = decorative(XBase);

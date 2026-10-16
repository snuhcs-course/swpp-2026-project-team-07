// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: a view that owns one PanResponder. Handlers arrive as props and
// are read when each touch event fires, so screens pass plain closures (no ref mirrors, no
// responder rebuilt per render). It is a class on purpose: the responder is created once per
// instance, outside the render path the React Compiler checks.
import { Component, type ComponentProps } from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated from 'react-native-reanimated';

type Ask = (e: GestureResponderEvent, g: PanResponderGestureState) => boolean;
type On = (e: GestureResponderEvent, g: PanResponderGestureState) => void;

export type PanHandlers = {
  onStartShould?: Ask;
  onMoveShould?: Ask;
  onMoveShouldCapture?: Ask;
  onGrant?: On;
  onMove?: On;
  onRelease?: On;
  onTerminate?: On;
  /** Whether another view may take over an active gesture (default true). */
  onTerminationRequest?: Ask;
  /** Turns gesture handling off without unmounting the children. */
  disabled?: boolean;
};

const PAN_KEYS = ['onStartShould', 'onMoveShould', 'onMoveShouldCapture', 'onGrant', 'onMove', 'onRelease', 'onTerminate', 'onTerminationRequest', 'disabled'] as const;

type Props = PanHandlers & Omit<ComponentProps<typeof Animated.View>, keyof PanHandlers>;

export class PanView extends Component<Props> {
  private readonly pan = PanResponder.create({
    onStartShouldSetPanResponder: (e, g) => !this.props.disabled && (this.props.onStartShould?.(e, g) ?? false),
    onMoveShouldSetPanResponder: (e, g) => !this.props.disabled && (this.props.onMoveShould?.(e, g) ?? false),
    onMoveShouldSetPanResponderCapture: (e, g) => !this.props.disabled && (this.props.onMoveShouldCapture?.(e, g) ?? false),
    onPanResponderGrant: (e, g) => this.props.onGrant?.(e, g),
    onPanResponderMove: (e, g) => this.props.onMove?.(e, g),
    onPanResponderRelease: (e, g) => this.props.onRelease?.(e, g),
    onPanResponderTerminate: (e, g) => this.props.onTerminate?.(e, g),
    onPanResponderTerminationRequest: (e, g) => this.props.onTerminationRequest?.(e, g) ?? true,
  });

  render() {
    const rest: Record<string, unknown> = { ...this.props };
    for (const k of PAN_KEYS) delete rest[k];
    return <Animated.View {...(rest as ComponentProps<typeof Animated.View>)} {...this.pan.panHandlers} />;
  }
}

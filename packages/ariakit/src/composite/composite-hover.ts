import { MouseEvent as ReactMouseEvent, useEffect } from "react";
import { closest, contains } from "ariakit-utils/dom";
import { addGlobalEventListener } from "ariakit-utils/events";
import { hasFocusWithin } from "ariakit-utils/focus";
import { useBooleanEvent, useEvent } from "ariakit-utils/hooks";
import { createMemoComponent, useStore } from "ariakit-utils/store";
import { createElement, createHook } from "ariakit-utils/system";
import { As, BooleanOrCallback, Options, Props } from "ariakit-utils/types";
import { CompositeContext } from "./__utils";
import { CompositeState } from "./composite-state";

let mouseMoving = false;
let previousScreenX = 0;
let previousScreenY = 0;

function hasMouseMovement(event: ReactMouseEvent | MouseEvent) {
  const movementX = event.movementX ?? event.screenX - previousScreenX;
  const movementY = event.movementY ?? event.screenY - previousScreenY;
  previousScreenX = event.screenX;
  previousScreenY = event.screenY;
  return movementX || movementY || process.env.NODE_ENV === "test";
}

function setMouseMoving(event: MouseEvent) {
  if (!hasMouseMovement(event)) return;
  mouseMoving = true;
}

function resetMouseMoving() {
  mouseMoving = false;
}

function getMouseDestination(event: ReactMouseEvent<HTMLElement>) {
  const relatedTarget = event.relatedTarget as Node | null;
  if (relatedTarget?.nodeType === Node.ELEMENT_NODE) {
    return relatedTarget as Element;
  }
  return null;
}

function hoveringInside(event: ReactMouseEvent<HTMLElement>) {
  const nextElement = getMouseDestination(event);
  if (!nextElement) return false;
  return contains(event.currentTarget, nextElement);
}

function movingToAnotherItem(event: ReactMouseEvent<HTMLElement>) {
  const dest = getMouseDestination(event);
  if (!dest) return false;
  const item = closest(dest, "[data-composite-hover]");
  return !!item;
}

/**
 * A component hook that returns props that can be passed to `Role` or any other
 * Ariakit component to render an element in a composite widget that receives
 * focus on mouse move and loses focus to the composite base element on mouse
 * leave. This should be combined with the `CompositeItem` component, the
 * `useCompositeItem` hook or any component/hook that uses them underneath.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const state = useCompositeState();
 * const props = useCompositeHover({ state });
 * <CompositeItem state={state} {...props}>Item</CompositeItem>
 * ```
 */
export const useCompositeHover = createHook<CompositeHoverOptions>(
  ({ state, focusOnHover = true, ...props }) => {
    state = useStore(state || CompositeContext, ["setActiveId", "baseRef"]);

    useEffect(() => {
      // We're not returning the event listener cleanup function here because we
      // may lose some events if this component is unmounted, but others are
      // still mounted.
      addGlobalEventListener("mousemove", setMouseMoving, true);
      // See https://github.com/ariakit/ariakit/issues/1137
      addGlobalEventListener("mousedown", resetMouseMoving, true);
      addGlobalEventListener("mouseup", resetMouseMoving, true);
      addGlobalEventListener("keydown", resetMouseMoving, true);
      addGlobalEventListener("scroll", resetMouseMoving, true);
    }, []);

    const onMouseMoveProp = props.onMouseMove;
    const focusOnHoverProp = useBooleanEvent(focusOnHover);

    const onMouseMove = useEvent((event: ReactMouseEvent<HTMLDivElement>) => {
      onMouseMoveProp?.(event);
      if (event.defaultPrevented) return;
      if (!hasMouseMovement(event)) return;
      if (!focusOnHoverProp(event)) return;
      // If we're hovering over an item that doesn't have DOM focus, we move
      // focus to the composite element. We're doing this here before setting
      // the active id because the composite element will automatically set the
      // active id to null when it receives focus.
      if (!hasFocusWithin(event.currentTarget)) {
        state?.baseRef.current?.focus();
      }
      state?.setActiveId(event.currentTarget.id);
    });

    const onMouseLeaveProp = props.onMouseLeave;

    const onMouseLeave = useEvent((event: ReactMouseEvent<HTMLDivElement>) => {
      onMouseLeaveProp?.(event);
      if (event.defaultPrevented) return;
      if (!mouseMoving) return;
      if (hoveringInside(event)) return;
      if (movingToAnotherItem(event)) return;
      if (!focusOnHoverProp(event)) return;
      state?.setActiveId(null);
      // Move focus to the composite element.
      state?.baseRef.current?.focus();
    });

    props = {
      "data-composite-hover": "",
      ...props,
      onMouseMove,
      onMouseLeave,
    };

    return props;
  }
);

/**
 * A component that renders an element in a composite widget that receives focus
 * on mouse move and loses focus to the composite base element on mouse leave.
 * This should be combined with the `CompositeItem` component, the
 * `useCompositeItem` hook or any component/hook that uses them underneath.
 * @see https://ariakit.org/components/composite
 * @example
 * ```jsx
 * const composite = useCompositeState();
 * <Composite state={composite}>
 *   <CompositeHover as={CompositeItem}>Item</CompositeHover>
 * </Composite>
 * ```
 */
export const CompositeHover = createMemoComponent<CompositeHoverOptions>(
  (props) => {
    const htmlProps = useCompositeHover(props);
    return createElement("div", htmlProps);
  }
);

export type CompositeHoverOptions<T extends As = "div"> = Options<T> & {
  /**
   * Object returned by the `useCompositeState` hook. If not provided, the
   * parent `Composite` component's context will be used.
   */
  state?: CompositeState;
  /**
   * Whether to focus the composite item on hover.
   * @default true
   */
  focusOnHover?: BooleanOrCallback<ReactMouseEvent<HTMLElement>>;
};

export type CompositeHoverProps<T extends As = "div"> = Props<
  CompositeHoverOptions<T>
>;

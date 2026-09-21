import { ReactNode, useEffect } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

import { SwipeAction, SwipeActionButton } from "@/components/shared/SwipeActionButton";
import { DELETE_SWIPE_RATIO, EDIT_SWIPE_RATIO, useSwipeActions } from "@/components/shared/use-swipe-actions";
import { EditIcon, TrashIcon } from "@/components/ui/Icon";
import { colors } from "@/lib/theme";

// Which way this row must be dragged to reveal its edit action — the opposite
// edge from wherever the bubble already sits, same convention as Messenger's
// swipe-to-reply, so the revealed edge is the one the bubble just vacated
// instead of colliding with it.
export type SwipeDirection = "left" | "right";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface SwipeableMessageRowProps {
  children: ReactNode;
  direction: SwipeDirection;
  /** True for any bubble with nothing for the user to correct. Callers pass
   *  isEditLocked rather than re-deriving it, so the gesture and the modal
   *  dispatch can never disagree about which bubbles are editable. */
  disabled?: boolean;
  onTriggerEdit: () => void;
  /** Present only on a bubble whose transaction can be removed. Omitted, the
   *  delete side is not draggable at all. */
  onTriggerDelete?: () => void;
  /** Bumped by the thread on scroll or content change — closes a parked row. */
  closeSignal?: number | string;
}

/**
 * Messenger-style swipe on a chat bubble, with two sides.
 *
 * Dragging toward the bubble's vacated edge reveals edit; dragging the other
 * way reveals delete. ⚠️ Neither acts on release — the row parks open and the
 * revealed button is what acts. For edit that button opens the editor
 * directly; for delete it opens a confirmation, because one of those destroys
 * a record and the other does not.
 *
 * The edit side keeps its original narrower travel; delete gets a wider cap so
 * its parked button has room for a label. See use-swipe-actions.
 */
export function SwipeableMessageRow({
  children,
  direction,
  disabled,
  onTriggerEdit,
  onTriggerDelete,
  closeSignal,
}: SwipeableMessageRowProps) {
  // Edit occupies the vacated edge; delete takes the other one, which is the
  // edge the bubble itself sits against.
  const editSide: SwipeDirection = direction === "left" ? "right" : "left";
  const deleteSide: SwipeDirection = direction === "left" ? "left" : "right";

  const swipe = useSwipeActions({
    left: (editSide === "left" && !disabled) || (deleteSide === "left" && onTriggerDelete)
      ? { ratio: editSide === "left" ? EDIT_SWIPE_RATIO : DELETE_SWIPE_RATIO }
      : undefined,
    right: (editSide === "right" && !disabled) || (deleteSide === "right" && onTriggerDelete)
      ? { ratio: editSide === "right" ? EDIT_SWIPE_RATIO : DELETE_SWIPE_RATIO }
      : undefined,
    // Only fully disabled when neither side has anything to offer.
    disabled: disabled && !onTriggerDelete,
  });

  const { close } = swipe;
  useEffect(() => {
    close();
  }, [closeSignal, close]);

  const editAction: SwipeAction | null = disabled
    ? null
    : {
        Icon: EditIcon,
        color: colors.green,
        label: "Sửa",
        testID: "btn-chat-edit-message",
        onPress: () => {
          close();
          onTriggerEdit();
        },
      };

  const deleteAction: SwipeAction | null = onTriggerDelete
    ? {
        Icon: TrashIcon,
        color: colors.peach,
        label: "Xóa",
        destructive: true,
        testID: "btn-chat-delete-transaction",
        onPress: () => {
          close();
          onTriggerDelete();
        },
      }
    : null;

  const sideAction = (side: SwipeDirection): SwipeAction | null =>
    side === editSide ? editAction : deleteAction;
  const sideRatio = (side: SwipeDirection): number =>
    side === editSide ? EDIT_SWIPE_RATIO : DELETE_SWIPE_RATIO;

  return (
    <View style={styles.wrapper}>
      {(["left", "right"] as const).map((side) => {
        const action = sideAction(side);
        if (!action) return null;
        return (
          <SwipeActionButton
            key={side}
            action={action}
            progress={side === "left" ? swipe.leftProgress : swipe.rightProgress}
            width={SCREEN_WIDTH * sideRatio(side)}
            parked={swipe.parkedSide === side}
            positionStyle={side === "left" ? styles.left : styles.right}
          />
        );
      })}
      <Animated.View style={{ transform: [{ translateX: swipe.translateX }] }} {...swipe.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  left: { left: 0 },
  right: { right: 0 },
});

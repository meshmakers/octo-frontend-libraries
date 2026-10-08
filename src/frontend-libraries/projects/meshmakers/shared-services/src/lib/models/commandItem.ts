import {SVGIcon} from '@progress/kendo-svg-icons/dist/svg-icon.interface';

export interface CommandItem {
  id: string;
  type: 'link' | 'section' | 'separator';
  selected?: boolean;
  svgIcon?: SVGIcon;
  text?: string;

  /*
   * Uses the angular router to navigate to the link
   */
  link?: string | ((eventArgs: CommandItemExecuteEventArgs) => Promise<string>);

  /*
   * Opens the link in a new window
   */
  href?: string | ((eventArgs: CommandItemExecuteEventArgs) => Promise<string>);

  /*
    * Click event handler
   */
  onClick?: (eventArgs: CommandItemExecuteEventArgs) =>  Promise<void>;

  target?: string;
  isVisible?: boolean | ((data?: unknown) => boolean | Promise<boolean>);

  /*
   * Disables the rendered control. In the list-view TOOLBAR a callback receives
   * the current checkbox selection (always an array of row items, possibly
   * empty), so selection-dependent actions can gate themselves, e.g.
   * `isDisabled: (sel) => !Array.isArray(sel) || sel.length === 0`.
   * In the actions column and context menu a callback receives the row item.
   */
  isDisabled?: boolean | ((data?: unknown) => boolean);

  /*
   * Why the item is disabled (AB#5572). Shown by the list view on row actions: the button stays
   * focusable (`aria-disabled`), the reason is announced via `aria-describedby` and shown in the
   * tooltip / overflow menu ("Delete — The adapter is deployed"). A callback receives the row item.
   * Only used while `isDisabled` is true; without it the list view uses a generic reason.
   */
  disabledReason?: string | ((data?: unknown) => string | null | undefined);
  children?: CommandItem[];

  /*
   * Fill mode of the rendered toolbar control (default 'solid'). Use 'flat'
   * for low-emphasis controls such as an icon-only overflow ("…") menu.
   */
  fillMode?: 'solid' | 'flat' | 'outline' | 'link' | 'clear';

  /*
   * Tooltip (title attribute) of the rendered toolbar control; falls back to
   * `text`. Set it on icon-only items (empty `text`) so they stay explained.
   */
  tooltip?: string;

  /*
   * Destructive action (AB#5570): in the list view the row action button renders with
   * danger styling (`themeColor="error"`) and the context / overflow menu item in the
   * error colour. Toolbar controls are not styled (page-level destructive actions belong in
   * the page header as danger text buttons). The `onClick` handler must still confirm
   * (danger dialog naming the target). See the Studio action guideline.
   */
  danger?: boolean;
}


export interface CommandItemExecuteEventArgs {
  commandItem: CommandItem;
  data?: unknown;
}

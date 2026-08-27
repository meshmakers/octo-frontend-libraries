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
}


export interface CommandItemExecuteEventArgs {
  commandItem: CommandItem;
  data?: unknown;
}

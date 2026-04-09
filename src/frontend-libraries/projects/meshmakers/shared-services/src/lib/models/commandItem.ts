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
  isDisabled?: boolean | ((data?: unknown) => boolean);
  children?: CommandItem[];
}


export interface CommandItemExecuteEventArgs {
  commandItem: CommandItem;
  data?: unknown;
}

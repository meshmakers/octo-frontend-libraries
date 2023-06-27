export class ObjectCloner {
  public static cloneObject<TR, TS1>(source: TS1, ignoreProperties: string[] | null = null): TR {
    // @ts-expect-error
    const clonedObject = Object.assign(<TR>{}, source);

    if (ignoreProperties != null) {
      for (const prop of ignoreProperties) {
        // @ts-expect-error
        delete clonedObject[prop];
      }
    }
    return <TR>clonedObject;
  }

  public static cloneObject2<TR, TS1, TS2>(source: TS1, source2: TS2, ignoreProperties: string[] | null = null): TR {
    // @ts-expect-error
    const clonedObject = Object.assign(<TR>{}, source, source2);

    if (ignoreProperties != null) {
      for (const prop of ignoreProperties) {
        // @ts-expect-error
        delete clonedObject[prop];
      }
    }
    return <TR>clonedObject;
  }
}

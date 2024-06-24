export class ObjectCloner {
  public static cloneObject<TR, TS1>(source: TS1, ignoreProperties: string[] | null = null): TR {
    const clonedObject = Object.assign({} as any, source);

    if (ignoreProperties != null) {
      for (const prop of ignoreProperties) {
         
        delete clonedObject[prop];
      }
    }
    return clonedObject as TR;
  }

  public static cloneObject2<TR, TS1, TS2>(source: TS1, source2: TS2, ignoreProperties: string[] | null = null): TR {
    const clonedObject = Object.assign({} as any, source, source2);

    if (ignoreProperties != null) {
      for (const prop of ignoreProperties) {
         
        delete clonedObject[prop];
      }
    }
    return clonedObject as TR;
  }
}

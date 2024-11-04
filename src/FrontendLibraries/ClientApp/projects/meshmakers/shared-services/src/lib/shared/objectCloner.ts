export class ObjectCloner {

  public static cloneArray<TR, TS1>(source: TS1[], ignoreProperties: string[] | null = null): TR[] {
      // Klone das Array
      let clonedArray = [...source] as TR as TR[];

      if (ignoreProperties && typeof clonedArray[0] === 'object') {
        clonedArray = clonedArray.map(item => {
          const clonedItem = { ...item } as any;
          ignoreProperties.forEach(prop => delete clonedItem[prop]);
          return clonedItem as TR;
        }) as unknown as TR[];
      }

      return clonedArray;
  }

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

export interface InspectionState {
  title: string;
  closeLabel: string;
  sections: {
    title: string;
    fields: { label: string; value: string }[];
  }[];
}

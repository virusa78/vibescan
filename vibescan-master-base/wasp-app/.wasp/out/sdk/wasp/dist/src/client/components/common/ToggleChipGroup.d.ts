type ToggleChipOption = {
    value: string;
    label: string;
    count?: number;
};
interface ToggleChipGroupProps {
    options: ToggleChipOption[];
    value: string;
    onChange: (next: string) => void;
    className?: string;
    ariaLabel?: string;
}
export declare function ToggleChipGroup({ options, value, onChange, className, ariaLabel, }: ToggleChipGroupProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ToggleChipGroup.d.ts.map
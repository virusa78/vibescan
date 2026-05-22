export function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tagName = target.tagName.toLowerCase();
    if (target.isContentEditable) {
        return true;
    }
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}
//# sourceMappingURL=keyboard.js.map
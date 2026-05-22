export function isReferenceObject(value) {
    return typeof value === 'object' && value !== null && '$ref' in value;
}
export function getOperation(pathItem, method) {
    if (!pathItem) {
        return undefined;
    }
    const operation = pathItem[method];
    if (!operation || typeof operation !== 'object' || isReferenceObject(operation)) {
        return undefined;
    }
    return operation;
}
//# sourceMappingURL=openapiTypes.js.map
export function calculateDeliverySuccessRate(deliveries) {
    if (deliveries.length === 0) {
        return 0;
    }
    const successful = deliveries.filter((delivery) => delivery.status === 'delivered').length;
    return Math.round((successful / deliveries.length) * 100);
}
export function calculateWebhookDeliveryStats(deliveries) {
    return {
        total_attempts: deliveries.length,
        successful: deliveries.filter((delivery) => delivery.status === 'delivered').length,
        failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
        pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
    };
}
//# sourceMappingURL=types.js.map
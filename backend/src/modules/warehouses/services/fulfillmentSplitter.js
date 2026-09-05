/**
 * Pure, zero-dependency greedy fulfillment split function.
 * Minimizes shipment count by attempting single-warehouse fulfillment first,
 * then greedily allocating stock across warehouses in descending order of available stock.
 * 
 * @param {string} productId - Product ID being fulfilled
 * @param {number} qtyNeeded - Quantity requested for fulfillment
 * @param {Array<Object>} warehouseStocks - Available stock levels across warehouses
 * @returns {Object} { splits, total_allocated, backorder_quantity, is_fully_allocated }
 */
export function splitFulfillment(productId, qtyNeeded, warehouseStocks = []) {
  const needed = Number(qtyNeeded) || 0;

  if (needed <= 0) {
    return {
      splits: [],
      total_allocated: 0,
      backorder_quantity: 0,
      is_fully_allocated: true,
    };
  }

  // Filter valid active warehouse stocks with available inventory > 0
  const validStocks = (Array.isArray(warehouseStocks) ? warehouseStocks : [])
    .filter(ws => {
      const available = Number(ws.quantity_available !== undefined ? ws.quantity_available : (ws.quantity_on_hand || 0) - (ws.quantity_reserved || 0));
      return ws && ws.warehouse_id && available > 0 && !ws.deleted_at;
    })
    .map(ws => {
      const available = Number(ws.quantity_available !== undefined ? ws.quantity_available : (ws.quantity_on_hand || 0) - (ws.quantity_reserved || 0));
      return {
        warehouse_id: ws.warehouse_id,
        warehouse_name: ws.warehouse_name || ws.name || 'Warehouse',
        quantity_available: available,
        priority: Number(ws.priority || 0),
      };
    });

  // Preference 1: Single warehouse exact/larger stock match to minimize shipment count to 1
  const singleWarehouseCandidates = validStocks.filter(ws => ws.quantity_available >= needed);

  if (singleWarehouseCandidates.length > 0) {
    // Sort single candidates by priority desc, then available stock desc
    singleWarehouseCandidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.quantity_available - a.quantity_available;
    });

    const chosen = singleWarehouseCandidates[0];
    return {
      splits: [
        {
          warehouse_id: chosen.warehouse_id,
          warehouse_name: chosen.warehouse_name,
          quantity: needed,
        },
      ],
      total_allocated: needed,
      backorder_quantity: 0,
      is_fully_allocated: true,
    };
  }

  // Preference 2: Multi-warehouse greedy split (sorted by available stock descending)
  const sortedStocks = [...validStocks].sort((a, b) => {
    if (b.quantity_available !== a.quantity_available) {
      return b.quantity_available - a.quantity_available;
    }
    return b.priority - a.priority;
  });

  const splits = [];
  let remainingNeeded = needed;

  for (const stock of sortedStocks) {
    if (remainingNeeded <= 0) break;

    const allocQty = Math.min(stock.quantity_available, remainingNeeded);
    if (allocQty > 0) {
      splits.push({
        warehouse_id: stock.warehouse_id,
        warehouse_name: stock.warehouse_name,
        quantity: allocQty,
      });
      remainingNeeded -= allocQty;
    }
  }

  const totalAllocated = needed - remainingNeeded;
  const backorderQuantity = Math.max(0, remainingNeeded);

  return {
    splits,
    total_allocated: totalAllocated,
    backorder_quantity: backorderQuantity,
    is_fully_allocated: remainingNeeded <= 0,
  };
}

export default {
  splitFulfillment,
};

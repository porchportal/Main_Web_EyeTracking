import React, { useState } from 'react';
import { GripVertical, Edit2, Save, X } from 'lucide-react';
import styles from '../styles/Consent.module.css';

export default function DragDropPriorityList() {
  const [items, setItems] = useState([
    { id: 1, name: 'Task 1', priority: 1, description: 'High priority task', hasPriority: true },
    { id: 2, name: 'Task 2', priority: 2, description: 'Medium priority task', hasPriority: true },
    { id: 3, name: 'Task 3', priority: null, description: 'Low priority task', hasPriority: false },
    { id: 4, name: 'Task 4', priority: 3, description: 'Another task', hasPriority: true },
    { id: 5, name: 'Task 5', priority: null, description: 'Final task', hasPriority: false }
  ]);
  
  const [draggedItem, setDraggedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Handle drag start
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    const newItems = [...items];
    const draggedIndex = newItems.findIndex(item => item.id === draggedItem.id);
    const targetIndex = newItems.findIndex(item => item.id === targetItem.id);

    // Remove dragged item
    const [removed] = newItems.splice(draggedIndex, 1);
    
    // Insert at new position
    newItems.splice(targetIndex, 0, removed);

    // Update priorities only for items that have priority enabled
    const itemsWithPriority = newItems.filter(item => item.hasPriority);
    itemsWithPriority.forEach((item, index) => {
      item.priority = index + 1;
    });

    setItems(newItems);
  };

  // Manual priority change
  const handlePriorityChange = (id, newPriority) => {
    const numPriority = parseInt(newPriority);
    const prioritizedItems = items.filter(item => item.hasPriority);
    
    if (numPriority < 1 || numPriority > prioritizedItems.length) return;

    const newItems = [...items];
    const itemIndex = newItems.findIndex(item => item.id === id);
    const item = newItems[itemIndex];
    
    if (!item.hasPriority) return;

    // Update priorities for items with priority enabled
    const itemsWithPriority = newItems.filter(item => item.hasPriority);
    const targetItem = itemsWithPriority.find(item => item.id === id);
    const otherItems = itemsWithPriority.filter(item => item.id !== id);
    
    otherItems.splice(numPriority - 1, 0, targetItem);
    
    otherItems.forEach((item, index) => {
      item.priority = index + 1;
    });

    setItems(newItems);
  };

  // Toggle priority functionality
  const togglePriority = (id) => {
    const newItems = [...items];
    const itemIndex = newItems.findIndex(item => item.id === id);
    const item = newItems[itemIndex];
    
    item.hasPriority = !item.hasPriority;
    
    if (item.hasPriority) {
      const maxPriority = Math.max(0, ...newItems.filter(item => item.hasPriority && item.id !== id).map(item => item.priority || 0));
      item.priority = maxPriority + 1;
    } else {
      item.priority = null;
      const itemsWithPriority = newItems.filter(item => item.hasPriority);
      itemsWithPriority.forEach((item, index) => {
        item.priority = index + 1;
      });
    }
    
    setItems(newItems);
  };

  // Edit functionality
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.name);
  };

  const saveEdit = () => {
    setItems(items.map(item => 
      item.id === editingId 
        ? { ...item, name: editValue }
        : item
    ));
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Priority badge color
  const getPriorityBadgeClass = (item) => {
    if (!item.hasPriority) return styles.priorityBadgeGray;
    if (item.priority <= 2) return styles.priorityBadgeRed;
    if (item.priority <= 4) return styles.priorityBadgeYellow;
    return styles.priorityBadgeGreen;
  };

  return (
    <div className={styles.buttonOrderSection}>
      {/* Info Box */}
      <div className={styles.infoBox}>
        <ul>
          <li>Toggle the checkbox to enable/disable priority for each item</li>
          <li>Drag items using the grip handle to reorder</li>
          <li>Change priority manually using the number input (only when enabled)</li>
          <li>Edit item names by clicking the edit icon</li>
          <li>Priority colors: Red (1-2), Yellow (3-4), Green (5+), Gray (disabled)</li>
        </ul>
      </div>
      {/* Task List */}
      <div className={styles.taskList}>
        {items
          .sort((a, b) => {
            if (a.hasPriority && !b.hasPriority) return -1;
            if (!a.hasPriority && b.hasPriority) return 1;
            if (a.hasPriority && b.hasPriority) return a.priority - b.priority;
            return 0;
          })
          .map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item)}
              className={styles.taskCard}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={item.hasPriority}
                onChange={() => togglePriority(item.id)}
                className={styles.taskCheckbox}
              />
              {/* Drag Handle */}
              <span className={styles.dragHandle}>
                <GripVertical size={18} />
              </span>
              {/* Priority Badge */}
              <span className={`${styles.priorityBadge} ${getPriorityBadgeClass(item)}`}>
                {item.hasPriority ? `#${item.priority}` : 'N/A'}
              </span>
              {/* Priority Input */}
              <div className={styles.priorityInputContainer}>
                <input
                  type="number"
                  min="1"
                  max={items.filter(i => i.hasPriority).length}
                  value={item.priority || ''}
                  onChange={(e) => handlePriorityChange(item.id, e.target.value)}
                  disabled={!item.hasPriority}
                  className={styles.priorityInput}
                />
              </div>
              {/* Task Content */}
              <div className={styles.taskContent}>
                {editingId === item.id ? (
                  <div className={styles.editRow}>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={styles.editInput}
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                    />
                    <button onClick={saveEdit} className={styles.saveEditBtn}><Save size={16} /></button>
                    <button onClick={cancelEdit} className={styles.cancelEditBtn}><X size={16} /></button>
                  </div>
                ) : (
                  <div className={styles.taskInfoRow}>
                    <div>
                      <span className={styles.taskName}>{item.name}</span>
                      <span className={styles.taskDesc}>{item.description}</span>
                    </div>
                    <button onClick={() => startEdit(item)} className={styles.editBtn}><Edit2 size={16} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
      {/* Order Summary */}
      <div className={styles.orderSummaryBox}>
        <div className={styles.orderSummaryTitle}>Current Order:</div>
        <div className={styles.orderSummaryRow}>
          <strong>With Priority:</strong>
          {items.filter(item => item.hasPriority).length === 0 ? (
            <span className={styles.orderSummaryNone}> None</span>
          ) : (
            items
              .filter(item => item.hasPriority)
              .sort((a, b) => a.priority - b.priority)
              .map((item, index) => (
                <span key={item.id}>
                  {index > 0 && ' → '}
                  {item.name} (#{item.priority})
                </span>
              ))
          )}
        </div>
        <div className={styles.orderSummaryRow}>
          <strong>Without Priority:</strong>
          {items.filter(item => !item.hasPriority).length === 0 ? (
            <span className={styles.orderSummaryNone}> None</span>
          ) : (
            items
              .filter(item => !item.hasPriority)
              .map((item, index) => (
                <span key={item.id}>
                  {index > 0 && ', '}
                  {item.name}
                </span>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
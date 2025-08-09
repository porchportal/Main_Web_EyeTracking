import React, { useState } from 'react';
import { GripVertical, Edit2, Save, X } from 'lucide-react';
import styles from '../../styles/Consent.module.css';

export default function DragDropPriorityList({ onOrderChange }) {
  const [items, setItems] = useState([
    { id: 1, name: 'Show preview', priority: 1, description: 'High priority task', hasPriority: true },
    { id: 2, name: 'Set Calibrate', priority: 2, description: 'Medium priority task', hasPriority: true },
    { id: 3, name: 'Set Random', priority: null, description: 'Low priority task', hasPriority: false },
    { id: 4, name: 'Random Dot', priority: 3, description: 'Another task', hasPriority: true },
  ]);
  
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedOverItem, setDraggedOverItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveStatus, setSaveStatus] = useState({ show: false, message: '', type: '' });
  const [isReordering, setIsReordering] = useState(false);

  // Handle drag start
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.6';
    e.target.style.transform = 'scale(1.05)';
    e.target.style.transition = 'all 0.2s ease';
    e.target.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
    e.target.style.zIndex = '1000';
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    e.target.style.transform = 'scale(1)';
    e.target.style.transition = 'all 0.3s ease';
    e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    e.target.style.zIndex = 'auto';
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drag enter
  const handleDragEnter = (e, item) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== item.id) {
      setDraggedOverItem(item);
    }
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear if we're leaving the entire item, not just a child element
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggedOverItem(null);
    }
  };

  // Handle drop
  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    setIsReordering(true);
    setDraggedOverItem(null);

    // Add a slight delay for smooth animation
    setTimeout(() => {
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
      
      // Reset reordering state after animation
      setTimeout(() => {
        setIsReordering(false);
      }, 300);
    }, 100);
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
    
    // Add pulse animation for priority changes
    setTimeout(() => {
      const element = document.querySelector(`[data-item-id="${id}"]`);
      if (element) {
        element.style.animation = 'priorityPulse 0.6s ease';
        setTimeout(() => {
          element.style.animation = '';
        }, 600);
      }
    }, 50);
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

  // Add save functionality
  const handleSaveOrder = async () => {
    try {
      // Get the ordered items with their priorities
      const orderedItems = items
        .filter(item => item.hasPriority)
        .sort((a, b) => a.priority - b.priority);

      // Format the order string
      const orderString = orderedItems
        .map(item => `${item.name} (#${item.priority})`)
        .join(' → ');

      // Update the parent's state with the new order
      if (onOrderChange) {
        onOrderChange(orderString);
      }

      // Show success message
      setSaveStatus({
        show: true,
        message: 'Button order saved successfully!',
        type: 'success'
      });

      // Hide the success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({
          show: false,
          message: '',
          type: ''
        });
      }, 3000);
    } catch (error) {
      console.error('Error saving button order:', error);
      setSaveStatus({
        show: true,
        message: 'Failed to save button order. Please try again.',
        type: 'error'
      });
    }
  };

  return (
    <div className={styles.buttonOrderSection}>
      {/* Info Box */}
      {/* <div className={styles.infoBox}>
        <ul>
          <li>Toggle the checkbox to enable/disable priority for each item</li>
          <li>Drag items using the grip handle to reorder</li>
          <li>Change priority manually using the number input (only when enabled)</li>
          <li>Edit item names by clicking the edit icon</li>
          <li>Priority colors: Red (1-2), Yellow (3-4), Green (5+), Gray (disabled)</li>
        </ul>
      </div> */}
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
              data-item-id={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              className={`${styles.taskCard} ${
                draggedItem && draggedItem.id === item.id ? styles.taskCardDragging : ''
              } ${
                draggedOverItem && draggedOverItem.id === item.id ? styles.taskCardDropTarget : ''
              } ${
                isReordering ? styles.taskCardReordering : ''
              }`}
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
                <div className={styles.taskInfoRow}>
                  <div>
                    <span className={styles.taskName}>{item.name}</span>
                    <span className={styles.taskDesc}>{item.description}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
      {/* Save Button */}
      <div className={styles.saveOrderContainer}>
        <button
          onClick={handleSaveOrder}
          className={styles.saveOrderButton}
        >
          <Save size={16} />
          Save Button Order
        </button>
        {saveStatus.show && (
          <div className={`${styles.saveStatus} ${styles[saveStatus.type]}`}>
            {saveStatus.message}
          </div>
        )}
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
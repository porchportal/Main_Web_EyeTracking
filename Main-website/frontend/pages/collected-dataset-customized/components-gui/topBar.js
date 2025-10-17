import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAdminSettings } from './adminSettings';
import { getOrCreateUserId } from '../../../utils/consentManager';
import OrderRequire from './Order&require';
import { clearAllStateDataWithCompletion } from './count&mark.js';
import styles from '../styles/topbar.module.css';

// Improved debounce function
const debounce = (func, wait) => {
  let timeout;
  let lastArgs;
  let lastThis;

  return function executedFunction(...args) {
    lastArgs = args;
    lastThis = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      func.apply(lastThis, lastArgs);
    }, wait);
  };
};

const TopBar = ({
  onButtonClick,
  isTopBarShown = true,
  isCameraActivated = false,
  selectedCamerasCount = 0,
  clickedButtons = new Set(),
  buttonClickCount = 0,
  currentImageTimes = 1,
  currentImageIndex = 0,
  totalImages = 1,
  currentImagePath = null
}) => {
  const router = useRouter();
  const { settings, updateSettings, fetchSettings, currentSettings, isLoading } = useAdminSettings();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showOrderRequire, setShowOrderRequire] = useState(false);
  const [orderRequireMessage, setOrderRequireMessage] = useState('');
  const [orderRequireList, setOrderRequireList] = useState([]);
  const [isManualShow, setIsManualShow] = useState(false);
  const [logoSize, setLogoSize] = useState({ width: 220, height: 160, maxHeight: 50 });
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Use refs to store stable references for debounced functions and event handlers
  const debouncedSaveSettingsRef = useRef(null);
  const settingsUpdateHandlerRef = useRef(null);

  // Get canvas function - use existing canvas from global manager
  const getCanvas = () => {
    // Use the global canvas manager from index.js if available
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }

    // Fallback: check for existing canvas
    let canvas = document.querySelector('#tracking-canvas');

    if (!canvas) {
      console.warn('No canvas found and no global canvas manager available');
      return null;
    }

    // Store global reference
    window.whiteScreenCanvas = canvas;
    return canvas;
  };

  // Initialize debounced save settings function once
  if (!debouncedSaveSettingsRef.current) {
    debouncedSaveSettingsRef.current = debounce(async (userId, newSettings, updateSettingsFn) => {
      if (!userId) return;

      try {
        const response = await fetch(`/api/data-center/settings/${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
          },
          body: JSON.stringify(newSettings)
        });

        if (!response.ok) {
          throw new Error('Failed to save settings to backend');
        }

        const latestSettings = await response.json();
        if (updateSettingsFn) {
          await updateSettingsFn(latestSettings, userId);
        }
      } catch (error) {
        console.error('TopBar - Error saving settings:', error);
      }
    }, 500);
  }

  // Initialize user ID and fetch initial settings
  useEffect(() => {
    const initializeUserId = async () => {
      const userId = getOrCreateUserId();
      if (userId) {
        setCurrentUserId(userId);
        await fetchSettings(userId);
      }
    };
    initializeUserId();
  }, [fetchSettings]);

  // Derive enableBackgroundChange from settings using useMemo
  const enableBackgroundChange = useMemo(() => {
    if (currentUserId && settings && settings[currentUserId]) {
      const userSettings = settings[currentUserId];
      return userSettings.enable_background_change || false;
    }
    return false;
  }, [currentUserId, settings]);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = async (event) => {
      if (event.detail?.userId) {
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        await fetchSettings(newUserId);
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => window.removeEventListener('userIdChange', handleUserIdChange);
  }, [fetchSettings]);

  // Listen for settings updates from admin page - use ref to avoid re-registering
  useEffect(() => {
    settingsUpdateHandlerRef.current = (event) => {
      if (event.detail?.type === 'captureSettings') {
        const { userId, times_set_random, delay_set_random } = event.detail;

        // Only update if values have actually changed
        if (times_set_random !== currentSettings.times_set_random || delay_set_random !== currentSettings.delay_set_random) {
          const newSettings = {
            times_set_random: Number(times_set_random) || currentSettings.times_set_random,
            delay_set_random: Number(delay_set_random) || currentSettings.delay_set_random
          };
          debouncedSaveSettingsRef.current(userId, newSettings, updateSettings);
        }
      }
    };
  });

  useEffect(() => {
    const handler = (event) => settingsUpdateHandlerRef.current(event);
    window.addEventListener('captureSettingsUpdate', handler);
    return () => window.removeEventListener('captureSettingsUpdate', handler);
  }, []);

  // Merged resize listener - handles both logo size and screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      // Update logo size
      if (width <= 360) {
        // Extra small mobile
        setLogoSize({ width: 120, height: 110, maxHeight: 28 });
      } else if (width <= 480) {
        // Mobile
        setLogoSize({ width: 140, height: 125, maxHeight: 32 });
      } else if (width <= 763) {
        // Below 763px - reduce image size
        setLogoSize({ width: 150, height: 130, maxHeight: 35 });
      } else if (width <= 768) {
        // Tablet portrait
        setLogoSize({ width: 160, height: 140, maxHeight: 40 });
      } else if (width <= 1024) {
        // Tablet landscape
        setLogoSize({ width: 200, height: 150, maxHeight: 45 });
      } else if (width <= 1142) {
        // Medium desktop - prevent overflow
        setLogoSize({ width: 195, height: 145, maxHeight: 42 });
      } else {
        // Desktop
        setLogoSize({ width: 220, height: 160, maxHeight: 50 });
      }

      // Update screen size
      setIsSmallScreen(width < 1009);

      // Close menu popup if screen becomes large
      if (width >= 1009) {
        setShowMenuPopup(false);
      }
    };

    // Initial call
    handleResize();

    // Add event listener for window resize with debouncing
    const debouncedResize = debounce(handleResize, 150);
    window.addEventListener('resize', debouncedResize);

    return () => window.removeEventListener('resize', debouncedResize);
  }, []);

  // Disable automatic show on page refresh to prevent flash
  // Only show when user manually clicks the button

  // Commented out automatic show to prevent flash on page refresh
  // useEffect(() => {
  //   if (currentSettings && currentSettings.buttons_order && currentSettings.buttons_order.trim() !== '' && !hasAutoShown) {
  //     console.log('Auto-showing button sequence. Settings:', currentSettings.buttons_order);
  //     // Parse buttons_order from settings
  //     const buttonsOrder = currentSettings.buttons_order;
  //     const buttonSteps = buttonsOrder.split('→').map(step => {
  //       return step.replace(/\(#\d+\)/g, '').trim();
  //     });
  //     const buttonsList = buttonSteps.filter(step => step.length > 0);

  //     if (buttonsList.length > 0) {
  //       setOrderRequireMessage('Button Click Sequence');
  //       setOrderRequireList(buttonsList);
  //       setShowOrderRequire(true);
  //       setIsManualShow(false); // This is an automatic show
  //       setHasAutoShown(true);

  //       // Auto-hide after 5 seconds only on initial load
  //       setTimeout(() => {
  //         setShowOrderRequire(false);
  //       }, 5000);
  //     }
  //   }
  // }, [currentSettings, hasAutoShown]);

  const handleButtonClick = (actionType) => {
    // Check camera activation for action buttons that require camera
    if (['setRandom', 'calibrate', 'randomDot'].includes(actionType)) {
      if (!isCameraActivated) {
        // Show notification through global camera state manager
        if (typeof window !== 'undefined' && window.cameraStateManager) {
          const actionNames = {
            'setRandom': 'Set Random',
            'calibrate': 'Set Calibrate',
            'randomDot': 'Random Dot'
          };
          window.cameraStateManager.showNotification(actionNames[actionType]);
        }
        return;
      }
    }

    // Ensure canvas is available before triggering actions that need it
    if (['setRandom', 'calibrate', 'randomDot', 'clearAll'].includes(actionType)) {
      const canvas = getCanvas();
      if (!canvas) {
        console.warn(`Canvas not available for action: ${actionType}`);
      }
    }

    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  const handleToggleTopBar = () => {
    // Use global control function
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(!isTopBarShown);
    }
  };

  const handleGoBack = () => {
    router.push('/');
  };

  const handleOrderRequirement = () => {
    // Toggle order requirements notification
    if (showOrderRequire) {
      // If already showing, hide it
      setShowOrderRequire(false);
    } else {
      // If not showing, show it with content from buttons_order
      setOrderRequireMessage('Button Click Sequence');

      // Parse buttons_order from settings
      let buttonsList = [];
      if (currentSettings && currentSettings.buttons_order) {
        // Parse the buttons_order string like "Show preview (#1) → Set Calibrate (#2) → Random Dot (#3)"
        const buttonsOrder = currentSettings.buttons_order;

        // Split by arrow and extract button names
        const buttonSteps = buttonsOrder.split('→').map(step => {
          // Remove numbering like (#1), (#2), etc. and trim whitespace
          return step.replace(/\(#\d+\)/g, '').trim();
        });

        buttonsList = buttonSteps.filter(step => step.length > 0);
      }

      // Fallback to default list if no buttons_order is configured
      if (buttonsList.length === 0) {
        buttonsList = [
          'Configure button sequence in admin settings',
          'Set buttons_order to define click sequence',
          'Buttons will be displayed in the order specified',
          'Use Order/Requirement button to view sequence',
          'Default sequence will be used if not configured'
        ];
      }

      setOrderRequireList(buttonsList);
      setShowOrderRequire(true);
      setIsManualShow(true); // This is a manual show (user clicked button)
    }
  };

  const handleClearState = () => {
    // Clear all localStorage data related to button clicks, progress, and completion counts
    const result = clearAllStateDataWithCompletion(currentUserId);

    if (result.success) {
      // Show success notification
      alert(`✅ Clear State Successful!\n\n${result.message}\n\nCleared keys: ${result.clearedKeys.join(', ')}`);

      // Trigger a page refresh to reset all state
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else {
      // Show error notification
      alert(`❌ Clear State Failed!\n\n${result.message}`);
    }
  };

  const handleToggleMenu = () => {
    setShowMenuPopup(!showMenuPopup);
  };

  const handleMenuItemClick = (actionType) => {
    handleButtonClick(actionType);
    setShowMenuPopup(false); // Close menu after clicking
  };

  // Reusable menu button configuration
  const menuButtonsConfig = [
    { actionType: 'randomDot', label: 'Random Dot', title: 'Start random dot sequence' },
    { actionType: 'setRandom', label: 'Set Random', title: 'Start random sequence' },
    { actionType: 'calibrate', label: 'Set Calibrate', title: 'Start calibration sequence' },
    { actionType: 'clearAll', label: 'Clear All', title: 'Clear all data' }
  ];

  // Reusable control groups configuration
  const controlGroupsConfig = [
    {
      key: 'times',
      label: 'Time(s):',
      value: currentSettings.times_set_random
    },
    {
      key: 'delay',
      label: 'Delay(s):',
      value: currentSettings.delay_set_random
    }
  ];

  return (
    <div className={styles.topbar} style={{ zIndex: 12, position: 'relative' }}>
      <div className={styles['topbar-left']}>
        <div className={styles['logo-container']}>
          <div className={styles.logo}>
            <Image
              src="/logo.png"
              alt="NECTEC NSTDA Logo"
              width={logoSize.width}
              height={logoSize.height}
              style={{
                objectFit: 'contain',
                maxHeight: `${logoSize.maxHeight}px`,
                width: 'auto'
              }}
              priority
            />
          </div>

          <div className={styles['controls-container']}>
            {controlGroupsConfig.map((config) => (
              <div className={styles['control-group']} key={config.key}>
                <span className={styles['control-label']} style={{
                  whiteSpace: 'nowrap',
                  width: '60px',
                  textAlign: 'right'
                }}>{config.label}</span>
                <div className={styles['control-input']}>
                  <div className={styles['control-input-field']} style={{
                    fontWeight: 'bold'
                  }}>
                    {config.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles['topbar-middle']}>
        {isSmallScreen ? (
          // Show hamburger menu button and essential buttons on small screens
          <div className={styles['small-screen-layout']}>
            <div className={styles['menu-button-container']}>
              <button
                className={styles['hamburger-menu-btn']}
                onClick={handleToggleMenu}
                title="Menu"
              >
                ☰ Menu
              </button>

              {/* Menu Popup */}
              {showMenuPopup && (
                <>
                  <div className={styles['menu-overlay']} onClick={() => setShowMenuPopup(false)}></div>
                  <div className={styles['menu-popup']}>
                    <div className={styles['menu-header']}>
                      <h3>Actions</h3>
                      <button
                        className={styles['menu-close-btn']}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowMenuPopup(false);
                        }}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles['menu-items']}>
                      {menuButtonsConfig.map((btn) => (
                        <button
                          key={btn.actionType}
                          className={styles['menu-item']}
                          onClick={() => handleMenuItemClick(btn.actionType)}
                        >
                          {btn.label}
                        </button>
                      ))}
                      <button className={styles['menu-item']} onClick={() => { handleGoBack(); setShowMenuPopup(false); }}>
                        ← Back
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Keep Show Preview and Select Camera visible */}
            <div className={styles['essential-buttons']}>
              <button
                className={styles.btn}
                onClick={() => handleButtonClick('preview')}
              >
                Show Preview
              </button>

              <button
                className={`${styles.btn} ${styles['camera-select-btn']}`}
                onClick={() => handleButtonClick('selectCamera')}
              >
                📷 Select Camera
                <span className={`${styles['camera-count']} ${selectedCamerasCount === 0 ? styles['no-cameras'] : ''}`}>
                  {selectedCamerasCount}
                </span>
              </button>
            </div>
          </div>
        ) : (
          // Show full button groups on larger screens
          <div className={styles['button-groups']}>
            <div className={styles['button-group']}>
              <div className={styles['button-row']}>
                {menuButtonsConfig.slice(0, 3).map((btn) => (
                  <button
                    key={btn.actionType}
                    className={styles.btn}
                    onClick={() => handleButtonClick(btn.actionType)}
                    title={btn.title}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className={`${styles['button-row']} ${styles.centered}`}>
                <button
                  className={`${styles.btn} ${styles['back-button']}`}
                  onClick={handleGoBack}
                  title="Go back to home page"
                >
                  ← Back
                </button>
                <button
                  className={styles.btn}
                  onClick={() => handleButtonClick('clearAll')}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className={styles['topbar-divider']}></div>

            <div className={styles['button-group']}>
              <div className={styles['button-row']}>
                <button
                  className={styles.btn}
                  onClick={() => handleButtonClick('preview')}
                >
                  Show Preview
                </button>

                <button
                  className={`${styles.btn} ${styles['camera-select-btn']}`}
                  onClick={() => handleButtonClick('selectCamera')}
                >
                  📷 Select Camera
                  <span className={`${styles['camera-count']} ${selectedCamerasCount === 0 ? styles['no-cameras'] : ''}`}>
                    {selectedCamerasCount}
                  </span>
                </button>
              </div>

              {/* Order/Requirement and Clear State button row - only show when enable_background_change is true, same y-axis as Clear All and Back buttons */}
              {enableBackgroundChange && (
                <div className={`${styles['button-row']} ${styles.centered}`} style={{ marginTop: '2px' }}>
                  <button
                    className={`${styles.btn} ${styles['order-requirement-btn']}`}
                    onClick={handleOrderRequirement}
                    title="Configure canvas image order and requirements"
                  >
                    Order/Requirement
                  </button>
                  <button
                    className={`${styles.btn} ${styles['clear-state-btn']}`}
                    onClick={handleClearState}
                    title="Clear all localStorage data (button clicks and progress)"
                  >
                    Clear State
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles['topbar-right']}>
        <div className={styles['control-buttons']}>
          <button
            className={`${styles['icon-btn']} ${styles['menu-btn']} ${styles.custom}`}
            onClick={handleToggleTopBar}
            title="Toggle TopBar"
          >
            <span className={styles['icon-text']}>≡</span>
          </button>
        </div>
      </div>

      {/* Order & Requirements Component */}
      <OrderRequire
        isHydrated={true}
        showOrderRequire={showOrderRequire}
        orderRequireMessage={orderRequireMessage}
        orderRequireList={orderRequireList}
        isManualShow={isManualShow}
        clickedButtons={clickedButtons}
        imageBackgroundPaths={currentSettings?.image_background_paths || []}
        currentUserId={currentUserId}
        buttonClickCount={buttonClickCount}
        currentImageTimes={currentImageTimes}
        currentImageIndex={currentImageIndex}
        totalImages={totalImages}
        currentImagePath={currentImagePath}
      />
    </div>
  );
};

export default TopBar;

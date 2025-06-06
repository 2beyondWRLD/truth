// Initialize tracking for exclamation hitboxes
this.exclamationHitboxes = [];// Create a simple clickable exclamation point
function createClickableExclamation(scene) {
  if (!scene || !scene.add) {
    console.error("Invalid scene for creating exclamation point");
    return;
  }
  
  const worldW = scene.background ? scene.background.displayWidth : 800;
  const worldH = scene.background ? scene.background.displayHeight : 600;
  
  // Better placement buffer
  const edgeBuffer = 100;
  
  // Find a valid position with a maximum number of attempts
  let validPosition = false;
  let exX = 0, exY = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 50;
  
  while (!validPosition && attempts < MAX_ATTEMPTS) {
    attempts++;
    exX = Phaser.Math.Between(edgeBuffer, worldW - edgeBuffer);
    exY = Phaser.Math.Between(edgeBuffer, worldH - edgeBuffer);
    
    // Check distance from player
    let tooCloseToPlayer = false;
    if (scene.player && scene.player.x !== undefined) {
      const playerDist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, exX, exY);
      tooCloseToPlayer = playerDist < 100;
    }
    
    // Check for obstacle overlap
    const hasObstacle = overlapsObstacle(scene, exX, exY, 40);
    
    if (!tooCloseToPlayer && !hasObstacle) {
      validPosition = true;
    }
  }
  
  if (!validPosition) {
    console.warn("Could not find valid position for exclamation point");
    return;
  }
  
  try {
    // First, create a visible exclamation sprite (non-interactive)
    const exclamation = scene.add.image(exX, exY, 'exclamation');
    exclamation.setScale(bgScale * 4);
    exclamation.setDepth(900);
    exclamation.setTint(0xffff00);
    
    // Then create a rectangular hitbox for interaction (like village buildings)
    const hitboxWidth = 50;
    const hitboxHeight = 50;
    const hitbox = scene.add.rectangle(
      exX, 
      exY,
      hitboxWidth,
      hitboxHeight,
      0xffff00,
      0.2 // Slight visibility for debugging
    );
    
    // Set properties
    hitbox.setOrigin(0.5);
    hitbox.setDepth(901);
    hitbox.setStrokeStyle(2, 0xffffff, 0.5);
    
    // Make it interactive
    hitbox.setInteractive();
    
    // Store data for cleanup
    hitbox.exclamationSprite = exclamation;
    hitbox.name = "exclamation_hitbox";
    
    // Add basic click handler
    hitbox.on('pointerdown', function() {
      console.log("Exclamation hitbox clicked at", this.x, this.y);
      
      // Start narrative flow
      scene.narrativeScreen = SCREEN_PROLOGUE;
      showPrologue(scene);
      
      // Clean up
      if (this.exclamationSprite) {
        this.exclamationSprite.destroy();
      }
      this.destroy();
    });
    
    // Track the hitbox
    if (!scene.exclamationHitboxes) {
      scene.exclamationHitboxes = [];
    }
    scene.exclamationHitboxes.push(hitbox);
    
    console.log("Created exclamation with hitbox at", exX, exY);
    
    return hitbox;
  } catch (error) {
    console.error("Error creating exclamation hitbox:", error);
    return null;
  }
}

/* =======================================================
   GLOBAL ZONE DATA & CONSTANTS
======================================================= */
const zoneList = [
  { name: "Outer Grasslands", mapKey: "OuterGrasslandsMap", backgroundKey: "outerGrasslands", foregroundKey: "outerGrasslandsForeground" },
  { name: "Shady Grove", mapKey: "ShadyGroveMap", backgroundKey: "shadyGrove", foregroundKey: "shadyGroveForeground" },
  { name: "Arid Desert", mapKey: "AridDesertMap", backgroundKey: "aridDesert", foregroundKey: "aridDesertForeground" },
  { name: "Village", mapKey: "villageCommonsMap", backgroundKey: "villageCommons", foregroundKey: "" }
];
let currentZoneIndex = 0;

// Narrative screen states – control narrative flow
const SCREEN_NONE = 0;
const SCREEN_PROLOGUE = 1;
const SCREEN_PROMPT = 2;
const SCREEN_CHOICES = 3;
const SCREEN_OUTCOME = 4;
const SCREEN_ITEM_MENU = 5;
const SCREEN_ITEM_PICK = 6;
const SCREEN_CAMPING_PROMPT = 14;

// Module UI states – while in these states, game movement is halted
const SCREEN_LIQUIDITY = 7;
const SCREEN_MERCHANT = 8;
const SCREEN_ROYAL = 9;
const SCREEN_TINKER = 10;
const SCREEN_CRAFT = 11;
const SCREEN_TRADING = 12;
const SCREEN_BATTLE = 13;

const bgScale = 0.3;
const playerScale = 2.5;

// Visual effect settings (simplified to avoid compatibility issues)
const EFFECT_COLORS = {
  LOOT: 0xFFD700,
  ATTACK: 0xFF0000,
  HEAL: 0x00FF00
};

// Sound effects (placeholders - will need actual sound files)
const SOUNDS = {
  ATTACK: 'attack',
  LOOT: 'loot_pickup',
  HURT: 'player_hurt',
  ITEM_USE: 'item_use',
  CRATE_BREAK: 'crate_break',
  MONSTER_HURT: 'monster_hurt',
  MONSTER_DEATH: 'monster_death',
  LEVEL_UP: 'level_up'
};

// Helper Function: Check if player has required camping materials (2 sticks and 1 cloth)
function hasCampingMaterials(scene) {
  const stick = scene.localInventory.find(item => item.name.toLowerCase() === "stick");
  const cloth = scene.localInventory.find(item => item.name.toLowerCase() === "cloth");
  return (stick && stick.quantity >= 2) && (cloth && cloth.quantity >= 1);
}

/* =======================================================
   1) OFF–CHAIN HELPER FUNCTIONS
======================================================= */
function createInitialStats(zoneName, existingOromozi = 1000) {
  return {
    health: 100,
    thirst: 100,
    hunger: 100,
    stamina: 100,
    oromozi: existingOromozi,
    currentZone: zoneName || "",
    experience: 0,
    level: 1
  };
}

function initEquippedData(scene) {
  scene.equippedItems = scene.equippedItems || [];
  scene.equippedResist = scene.equippedResist || {};
}

function recalcEquippedResist(scene) {
  scene.equippedResist = {};
  for (let itemName of scene.equippedItems) {
    const data = getItemData(scene, itemName);
    if (!data || !data.resist) continue;
    for (let key of Object.keys(data.resist)) {
      if (!scene.equippedResist[key]) scene.equippedResist[key] = 0;
      scene.equippedResist[key] += data.resist[key];
    }
  }
}

/* =======================================================
   GLOBAL HUD UPDATE FUNCTION
======================================================= */
function globalUpdateHUD(scene) {
  if (!scene || !scene.hudText) return;
  
  try {
    if (scene.constructor.name === 'DungeonScene') {
      // DungeonScene-specific HUD update
      scene.hudText.setText(`HEALTH: ${scene.playerHealth}/${scene.playerMaxHealth} | LEVEL: ${scene.playerStats.level || 1}`);
    } else {
      // MainGameScene and other scenes
      const s = scene.playerStats;
      scene.hudText.setText(""); // Clear text to prevent overlay
      if (scene.currentZone === "Village") {
        scene.hudText.setText(`OROMOZI: ${s.oromozi} | LEVEL: ${s.level || 1}`);
      } else {
        scene.hudText.setText(
          `HEALTH: ${s.health}   STAMINA: ${s.stamina}\nHUNGER: ${s.hunger}   THIRST: ${s.thirst}\nOROMOZI: ${s.oromozi}   LEVEL: ${s.level || 1}`
        );
      }
    }
    
    // Update health bar if it exists
    if (scene.healthBar) {
      let healthValue, maxHealthValue;
      
      if (scene.constructor.name === 'DungeonScene') {
        healthValue = scene.playerHealth;
        maxHealthValue = scene.playerMaxHealth;
      } else {
        healthValue = scene.playerStats.health;
        maxHealthValue = 100;
      }
      
      const healthPercent = healthValue / maxHealthValue;
      scene.healthBar.clear();
      
      // Set color based on health percentage
      let barColor = 0x00ff00; // Green by default
      if (healthPercent < 0.3) {
        barColor = 0xff0000; // Red when low health
      } else if (healthPercent < 0.6) {
        barColor = 0xffff00; // Yellow when medium health
      }
      
      scene.healthBar.fillStyle(barColor, 1);
      scene.healthBar.fillRect(10, 10, 150 * healthPercent, 10);
      scene.healthBar.lineStyle(2, 0xffffff, 1);
      scene.healthBar.strokeRect(10, 10, 150, 10);
    }
  } catch (error) {
    console.warn("Error updating HUD:", error);
  }
}

// Modify original updateHUD to use the global function
function updateHUD(scene) {
  globalUpdateHUD(scene);
}

function getItemData(scene, itemName) {
  if (!itemName) return null;
  const lootData = scene.cache.json.get("lootTable");
  if (!lootData || !lootData.zones) return null;
  const zoneKeys = Object.keys(lootData.zones);
  for (let zk of zoneKeys) {
    const itemsArr = lootData.zones[zk];
    if (!itemsArr) continue;
    for (let itemObj of itemsArr) {
      if (itemObj.name === itemName) return itemObj;
    }
  }
  return null;
}

function getAllLootItems(scene) {
  const lootData = scene.cache.json.get("lootTable");
  if (!lootData || !lootData.zones) return ["Stick"];
  const allItems = new Set();
  Object.keys(lootData.zones).forEach(zone => {
    lootData.zones[zone].forEach(item => allItems.add(item.name));
  });
  return Array.from(allItems);
}

function getRandomLootForZone(scene) {
  const zoneName = scene.currentZone;
  const lootData = scene.cache.json.get("lootTable");
  if (!lootData || !lootData.zones) return "Stick";
  const zoneItems = lootData.zones[zoneName];
  if (!zoneItems || zoneItems.length === 0) return "Stick";
  
  // Item rarity adjustment
  const rarityRoll = Math.random();
  if (rarityRoll < 0.15) return null; // 15% chance of no loot
  
  if (rarityRoll > 0.95 && scene.playerStats.level >= 3) {
    // 5% chance of rare loot for higher level players
    const rareItems = zoneItems.filter(item => item.rarity === "rare");
    if (rareItems.length > 0) {
      const rareIndex = Phaser.Math.Between(0, rareItems.length - 1);
      return rareItems[rareIndex].name;
    }
  }
  
  const randIndex = Phaser.Math.Between(0, zoneItems.length - 1);
  return zoneItems[randIndex].name || "Stick";
}

function applyItemEffects(scene, itemData) {
  if (!itemData || !itemData.statEffects) return false;
  let modified = false;
  for (let [stat, value] of Object.entries(itemData.statEffects)) {
    if (scene.playerStats[stat] !== undefined) {
      const oldValue = scene.playerStats[stat];
      scene.playerStats[stat] = Math.min(scene.playerStats[stat] + value, 100);
      modified = true;
      
      // Visual feedback based on stat type
      if (scene.player && value > 0) {
        createFloatingText(scene, scene.player.x, scene.player.y - 20, `+${value} ${stat}`, 0x00ff00);
      }
    }
  }
  return modified;
}

function applySurvivalTickAndOutcome(scene, outcomeText) {
  if (!scene.playerStats) scene.playerStats = createInitialStats(scene.currentZone);
  
  console.log("Applying outcome:", outcomeText);
  
  // FIRST: Parse and apply the outcome effects from the narrative prompt
  let statChanges = [];
  
  // UPDATED REGEX: Make the pattern more flexible to catch all stat formats
  const statChangeRegex = /\(\s*([-+]\d+)\s*(\w+)\s*\)(?:\s*\[type=(\w+)\])?/g;
  let match;
  
  // Collect all stat changes first
  while ((match = statChangeRegex.exec(outcomeText)) !== null) {
    console.log("Matched stat change:", match);
    const value = parseInt(match[1]);
    const stat = match[2].toLowerCase();
    const type = match[3] ? match[3].toLowerCase() : null;
    
    statChanges.push({ value, stat, type });
  }
  
  console.log("Parsed stat changes:", statChanges);
  
  // Now apply all stat changes
  for (const change of statChanges) {
    const { value, stat, type } = change;
    
    if (stat === 'health') {
      if (type && value < 0) {
        // Negative health with damage type (e.g., predator, fall)
        let dmgVal = -value; // damage is positive
        const rVal = scene.equippedResist[type] || 0;
        const damageReduction = Math.min(rVal, dmgVal * 0.7); // Cap damage reduction at 70%
        dmgVal = Math.max(dmgVal - damageReduction, 0);
        
        // Show damage reduction feedback if significant
        if (damageReduction > 0 && scene.player) {
          createFloatingText(scene, scene.player.x, scene.player.y - 30, `Resisted ${damageReduction.toFixed(1)}`, 0xffdd00);
        }
        
        scene.playerStats.health = Math.max(scene.playerStats.health - dmgVal, 0);
        
        // Damage feedback
        if (scene.player && dmgVal > 0) {
          scene.player.setTint(0xff0000);
          scene.time.delayedCall(200, () => scene.player.clearTint());
          scene.cameras.main.shake(100, 0.005 * dmgVal);
          createFloatingText(scene, scene.player.x, scene.player.y - 10, `-${dmgVal}`, 0xff0000);
        }
      } else {
        // Regular health change
        scene.playerStats.health = Math.max(scene.playerStats.health + value, 0);
        if (value > 0) {
          scene.playerStats.health = Math.min(scene.playerStats.health, 100);
          if (scene.player) {
            createFloatingText(scene, scene.player.x, scene.player.y - 20, `+${value} health`, 0x00ff00);
          }
        }
      }
    } else if (['stamina', 'thirst', 'hunger'].includes(stat)) {
      // Adjust stat
      const oldValue = scene.playerStats[stat];
      scene.playerStats[stat] = Math.max(scene.playerStats[stat] + value, 0);
      scene.playerStats[stat] = Math.min(scene.playerStats[stat], 100);
      
      // Visual feedback for significant changes
      if (value != 0 && scene.player) {
        const color = value > 0 ? 0x00ff00 : 0xff6600;
        const sign = value > 0 ? '+' : '';
        createFloatingText(scene, scene.player.x, scene.player.y - 15, `${sign}${value} ${stat}`, color);
      }
      
      console.log(`${stat} changed from ${oldValue} to ${scene.playerStats[stat]}`);
    } else if (stat === 'experience' || stat === 'exp') {
      // Add experience and level up system
      if (value > 0 && scene.playerStats) {
        scene.playerStats.experience = (scene.playerStats.experience || 0) + value;
        if (scene.player) {
          createFloatingText(scene, scene.player.x, scene.player.y - 25, `+${value} EXP`, 0x00ffff);
        }
        
        // Check for level up
        checkLevelUp(scene);
      }
    } else {
      console.warn(`Unknown stat in outcome: ${stat}`);
    }
  }
  
  // SECOND: Apply survival ticks (after narrative outcome effects)
  if (scene.currentZone !== "Village") {
    scene.playerStats.thirst = Math.max(scene.playerStats.thirst - 5, 0);
    scene.playerStats.hunger = Math.max(scene.playerStats.hunger - 5, 0);
    scene.playerStats.stamina = Math.max(scene.playerStats.stamina - 5, 0);
  }
  
  console.log("After applying outcome + survival tick, player stats:", scene.playerStats);

  // THIRD: Apply any additional penalties for critically low survival stats
  if (scene.currentZone !== "Village") {
    const { stamina, thirst, hunger, health } = scene.playerStats;
    let healthReduction = 0;
    
    // Survival mechanics - health penalties for very low stats
    if (stamina <= 10 || thirst <= 10 || hunger <= 10) {
      healthReduction = 8;
    } else if (stamina <= 25 || thirst <= 25 || hunger <= 25) {
      healthReduction = 3;
    }
    
    if (healthReduction > 0) {
      scene.playerStats.health = Math.max(health - healthReduction, 0);
      console.log(`Health reduced by ${healthReduction} due to low stats in Scavenger Mode`);
      
      if (scene.player) {
        createFloatingText(scene, scene.player.x, scene.player.y, `${healthReduction} damage due to survival`, 0xff6600);
      }
    }
  }
}

// Check if player should level up based on experience
function checkLevelUp(scene) {
  if (!scene.playerStats) return;
  
  const currLevel = scene.playerStats.level || 1;
  const expNeeded = currLevel * 100; // Simple formula: level * 100 exp needed to level up
  
  if (scene.playerStats.experience >= expNeeded) {
    scene.playerStats.level = currLevel + 1;
    scene.playerStats.experience -= expNeeded;
    
    // Level up benefits
    scene.playerStats.health = 100; // Full health on level up
    
    // Visual feedback
    if (scene.player) {
      createSimpleEffect(scene, scene.player.x, scene.player.y, 0xffff00);
      
      createFloatingText(scene, scene.player.x, scene.player.y - 40, `LEVEL UP! ${currLevel} → ${currLevel + 1}`, 0xffff00, 20);
      
      // Camera effect
      scene.cameras.main.flash(500, 255, 255, 200);
      
      // Update HUD
      updateHUD(scene);
    }
  }
}

async function applyOutcome(scene, outcomeText) {
  console.log("Before applying outcome, player stats:", scene.playerStats);
  applySurvivalTickAndOutcome(scene, outcomeText);
  console.log("After applying outcome, player stats:", scene.playerStats);
  
  // Award experience for completing events
  if (scene.playerStats && scene.currentZone !== "Village") {
    const baseExp = 5;
    const expGain = baseExp + Math.floor(Math.random() * 5);
    scene.playerStats.experience = (scene.playerStats.experience || 0) + expGain;
    outcomeText += `\n(+${expGain} EXP)`;
    checkLevelUp(scene);
  }
  
  if (outcomeText.includes("(+Loot)")) {
    const randomItemName = getRandomLootForZone(scene);
    if (randomItemName) {
      addToInventory(scene, randomItemName);
      outcomeText += `\nLoot received: ${randomItemName}`;
      
      // FIX 1: Add loot to the same log that shows crate loot
      addToLog(scene, `Received: ${randomItemName}`);
      
      // Visual loot feedback
      if (scene.player) {
        createSimpleEffect(scene, scene.player.x, scene.player.y + 10, EFFECT_COLORS.LOOT);
      }
    } else {
      outcomeText += "\nSearched but found nothing of value.";
      // Also log no loot found
      addToLog(scene, "Searched but found nothing of value");
    }
  }
  updateHUD(scene);

  const travelMatch = outcomeText.match(/\(Travel to ([^)]+)\)/i);
  if (travelMatch) {
    const zoneName = travelMatch[1].trim();
    console.log("Travel outcome detected. Zone name extracted:", zoneName);
    const zone = zoneList.find(z => z.name.toLowerCase() === zoneName.toLowerCase());
    if (zone) {
      console.log("Traveling to zone:", zone.name);
      showDialog(scene, `Traveling to ${zone.name}...\n(Press SPACE to continue)`);
      await new Promise(resolve => {
        scene.input.keyboard.once("keydown-SPACE", () => resolve());
      });
      scene.time.removeAllEvents();
      scene.scene.restart({ zone: zone, inventory: scene.localInventory, promptCount: scene.promptCount });
      return;
    } else {
      console.warn("No matching zone found for:", zoneName);
    }
  }

  // Check for fishing scene transition
  if (outcomeText.toLowerCase().includes("transition to fishing scene") || 
      outcomeText.toLowerCase().includes("you take out your fishing gear")) {
    console.log("Transitioning to FishingScene");
    console.log("Current inventory:", scene.localInventory);
    console.log("Current zone:", scene.currentZone);
    console.log("Current player stats:", scene.playerStats);
    
    // Save current inventory and stats
    const currentInventory = [...scene.localInventory];
    const currentStats = { ...scene.playerStats };
    
    scene.scene.start('FishingScene', {
      inventory: currentInventory,
      zone: scene.currentZone,
      playerStats: currentStats
    });
    return;
  }

  showDialog(scene, `Outcome:\n\n${outcomeText}\n\n(Press SPACE to continue)`);
}
function addToInventory(scene, itemName, quantity = 1) {
  if (!itemName) return; // Prevent adding null items
  const existingItem = scene.localInventory.find(item => item.name === itemName);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    scene.localInventory.push({ name: itemName, quantity: quantity });
  }
  
  // Visual feedback
  if (scene.player) {
    createFloatingText(scene, scene.player.x, scene.player.y - 30, `+${quantity} ${itemName}`, 0xffff00);
  }
}

function removeFromInventory(scene, itemName, quantity = 1) {
  const itemIndex = scene.localInventory.findIndex(item => item.name === itemName);
  if (itemIndex !== -1) {
    const item = scene.localInventory[itemIndex];
    item.quantity -= quantity;
    if (item.quantity <= 0) {
      scene.localInventory.splice(itemIndex, 1);
    }
  }
}

function getInventoryDisplay(scene) {
  return scene.localInventory.map(item => {
    const itemData = getItemData(scene, item.name);
    const rarity = itemData && itemData.rarity ? ` [${itemData.rarity}]` : '';
    return `${item.name}${rarity} x${item.quantity}`;
  });
}

function addToLog(scene, message) {
  if (!scene || !scene.logMessages || !scene.logText) return;
  if (!message || typeof message !== 'string') {
    message = String(message || 'Event occurred');
  }
  
  try {
    console.log("Log update:", message);
    scene.logMessages.push(message);
    if (scene.logMessages.length > 5) {
      scene.logMessages.shift(); // Remove the oldest message
    }
    scene.logText.setText(scene.logMessages.join('\n'));
    
    // Add visual highlight to log briefly
    scene.logText.setTint(0xffff00);
    scene.time.delayedCall(1000, () => {
      if (scene.logText && scene.logText.clearTint) {
        scene.logText.clearTint();
      }
    });
  } catch (error) {
    console.warn("Error updating log:", error);
  }
}

// Simple visual effect that works without particle system
function createSimpleEffect(scene, x, y, color) {
  // Create a circle that fades out
  const circle = scene.add.circle(x, y, 15, color, 0.7);
  circle.setDepth(3000);
  
  // Fade out and expand
  scene.tweens.add({
    targets: circle,
    alpha: 0,
    scale: 2,
    duration: 500,
    onComplete: () => {
      circle.destroy();
    }
  });
}

// Create floating text that rises and fades
function createFloatingText(scene, x, y, text, color = 0xffffff, fontSize = 16) {
  if (!scene || !scene.add) return; // Safety check
  if (!text || typeof text !== 'string') text = String(text || ''); // Ensure text is a string
  
  const floatingText = scene.add.text(x, y, text, {
    fontFamily: 'Arial',
    fontSize: `${fontSize}px`,
    color: `#${color.toString(16).padStart(6, '0')}`,
    stroke: '#000000',
    strokeThickness: 2,
    align: 'center'
  }).setOrigin(0.5);
  
  floatingText.setDepth(5000);
  
  scene.tweens.add({
    targets: floatingText,
    y: y - 50,
    alpha: 0,
    duration: 1500,
    ease: 'Power2',
    onComplete: () => {
      floatingText.destroy();
    }
  });
}

/* =======================================================
   4) LIQUIDITY POOL UI FUNCTIONS (WITH MODAL OVERLAY AND SCROLLING)
======================================================= */
function showModalOverlay(scene) {
  hideModalOverlay(scene);
  const modal = scene.add.rectangle(
    scene.cameras.main.worldView.x,
    scene.cameras.main.worldView.y,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0x000000,
    0.4
  );
  modal.setOrigin(0, 0);
  modal.setScrollFactor(0);
  modal.setDepth(800);
  scene.liquidityOverlay = modal;
}

function hideModalOverlay(scene) {
  if (scene.liquidityOverlay) {
    scene.liquidityOverlay.destroy();
    scene.liquidityOverlay = null;
  }
}

function createScrollableMenu(scene, title, options) {
  const boxW = 300; // Increased width for better text display
  const boxH = 250; // Increased height for better spacing
  const boxX = (scene.game.config.width - boxW) / 2;
  const boxY = (scene.game.config.height - boxH) / 2;
  const maxVisible = 6;
  let scrollIndex = 0;

  // Create dialog background
  showDialog(scene, ""); // Clear previous text
  scene.dialogBg.clear();
  scene.dialogBg.fillStyle(0x000000, 0.8);
  scene.dialogBg.fillRect(boxX, boxY, boxW, boxH);
  scene.dialogBg.lineStyle(2, 0xffffff, 1);
  scene.dialogBg.strokeRect(boxX, boxY, boxW, boxH);
  
  // Add a separator line between title and options
  scene.dialogBg.lineStyle(1, 0xaaaaaa, 0.7);
  scene.dialogBg.lineBetween(boxX + 10, boxY + 60, boxX + boxW - 10, boxY + 60);
  
  // Create title text separately for better styling and positioning
  if (scene.menuTitleText) {
    scene.menuTitleText.destroy();
  }
  
  scene.menuTitleText = scene.add.text(
    boxX + boxW/2, 
    boxY + 20, 
    title, 
    {
      font: "16px Arial",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: boxW - 40 }  // Add word wrapping with good margins
    }
  );
  
  scene.menuTitleText.setOrigin(0.5, 0);
  scene.menuTitleText.setDepth(1601);
  scene.menuTitleText.setScrollFactor(0);
  
  // Instructions text BELOW the separator line to avoid overlap
  if (scene.menuInstructionsText) {
    scene.menuInstructionsText.destroy();
  }
  
  scene.menuInstructionsText = scene.add.text(
    boxX + boxW/2, 
    boxY + 65, 
    "(Use UP/DOWN to scroll, SPACE to select)", 
    {
      font: "12px Arial",
      fill: "#cccccc",
      stroke: "#000000",
      strokeThickness: 1,
      align: "center"
    }
  );
  
  scene.menuInstructionsText.setOrigin(0.5, 0);
  scene.menuInstructionsText.setDepth(1601);
  scene.menuInstructionsText.setScrollFactor(0);

  const updateMenu = () => {
    clearButtons(scene);
    const visibleOptions = options.slice(scrollIndex, scrollIndex + maxVisible);
    
    visibleOptions.forEach((option, i) => {
      const textColor = option.highlight ? "#ffff00" : "#ffffff";
      
      const txt = scene.add.text(boxX + 20, boxY + 90 + i * 25, option.label, { 
        font: "14px Arial", 
        fill: textColor,
        stroke: "#000000",
        strokeThickness: 2
      });
      
      txt.setDepth(1601);
      txt.setInteractive({ useHandCursor: true });
      txt.on("pointerdown", () => {
        scene.input.keyboard.off("keydown-UP");
        scene.input.keyboard.off("keydown-DOWN");
        scene.input.keyboard.off("keydown-SPACE");
        option.callback();
      });
      txt.on("pointerover", () => {
        txt.setStyle({ fill: "#ff9900" });
      });
      txt.on("pointerout", () => {
        txt.setStyle({ fill: option.highlight ? "#ffff00" : "#ffffff" });
      });
      scene.buttons.push(txt);
      txt.setScrollFactor(0);
    });
    
    // Add scroll indicators if needed
    if (scrollIndex > 0) {
      const upArrow = scene.add.text(boxX + boxW - 20, boxY + 70, "▲", { 
        font: "16px Arial", 
        fill: "#ffffff" 
      }).setDepth(1601).setScrollFactor(0);
      scene.buttons.push(upArrow);
    }
    
    if (scrollIndex + maxVisible < options.length) {
      const downArrow = scene.add.text(boxX + boxW - 20, boxY + boxH - 20, "▼", { 
        font: "16px Arial", 
        fill: "#ffffff" 
      }).setDepth(1601).setScrollFactor(0);
      scene.buttons.push(downArrow);
    }
  };

  updateMenu();

  scene.input.keyboard.on("keydown-UP", () => {
    if (scrollIndex > 0) {
      scrollIndex--;
      updateMenu();
    }
  });

  scene.input.keyboard.on("keydown-DOWN", () => {
    if (scrollIndex + maxVisible < options.length) {
      scrollIndex++;
      updateMenu();
    }
  });

  scene.input.keyboard.once("keydown-SPACE", () => {
    scene.input.keyboard.off("keydown-UP");
    scene.input.keyboard.off("keydown-DOWN");
    const selectedIndex = scrollIndex;
    if (options[selectedIndex]) options[selectedIndex].callback();
  });
}

function showDepositResourceScreen(scene) {
  const resources = scene.localInventory.filter(item => {
    const itemData = getItemData(scene, item.name);
    return itemData && itemData.canDeposit;
  });
  if (!resources || resources.length === 0) {
    alert("No depositable resources available.");
    showLiquidityPoolOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = resources.map((resource, index) => ({
    label: `${resource.name} x${resource.quantity}`,
    callback: () => {
      clearButtons(scene);
      promptDepositDetails(scene, resource.name, index);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showLiquidityPoolOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select a resource to deposit:", options);
}

function promptDepositDetails(scene, resource, index) {
  clearButtons(scene);
  hideDialog(scene);
  let amountStr = prompt(`Enter deposit amount for ${resource} (units):`, "10");
  let durationStr = prompt("Enter lockup duration (seconds):", "604800");
  let amount = parseInt(amountStr, 10);
  let duration = parseInt(durationStr, 10);
  if (isNaN(amount) || isNaN(duration)) {
    alert("Invalid input. Returning to resource selection.");
    showDepositResourceScreen(scene);
    return;
  }
  let estimatedYield = Math.floor(amount * (duration / 86400) * 50);
  showConfirmDeposit(scene, resource, amount, duration, estimatedYield, index);
}

function showConfirmDeposit(scene, resource, amount, duration, estimatedYield, index) {
  clearButtons(scene);
  showDialog(scene, `Deposit ${amount} units of ${resource} for ${duration} seconds?\nEstimated yield: ${estimatedYield} units.\nConfirm deposit?`);
  const options = [
    {
      label: "Yes",
      callback: async () => {
        removeFromInventory(scene, resource, amount);
        scene.deposits.push({ amount, duration: duration, startTime: Date.now() });
        alert("Liquidity deposit successful (simulated).");
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    },
    {
      label: "No",
      callback: () => {
        clearButtons(scene);
        showDepositResourceScreen(scene);
      }
    }
  ];
  createButtons(scene, options);
}

function showLiquidityPoolOptions(scene) {
  scene.narrativeScreen = SCREEN_LIQUIDITY;
  showModalOverlay(scene);
  const options = [
    {
      label: "Deposit Resource",
      callback: () => {
        clearButtons(scene);
        showDepositResourceScreen(scene);
      }
    },
    {
      label: "View Deposits & Yield",
      callback: () => {
        const deposits = scene.deposits.map((d, i) => `${i}: ${d.amount} units, ${Math.floor((Date.now() - d.startTime) / 1000)}s elapsed`).join("\n");
        alert(`Deposits:\n${deposits || "None"}`);
        clearButtons(scene);
        showLiquidityPoolOptions(scene);
      }
    },
    {
      label: "Withdraw Resources",
      callback: () => {
        clearButtons(scene);
        showWithdrawResourceScreen(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    }
  ];
  createScrollableMenu(scene, "Liquidity Pool Options:\nSelect an option:", options);
}

function showWithdrawResourceScreen(scene) {
  if (!scene.deposits || scene.deposits.length === 0) {
    alert("No deposits to withdraw.");
    showLiquidityPoolOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = scene.deposits.map((deposit, index) => ({
    label: `${deposit.amount} units (${Math.floor((Date.now() - deposit.startTime) / 1000)}s)`,
    callback: async () => {
      const deposit = scene.deposits[index];
      const elapsed = (Date.now() - deposit.startTime) / 1000;
      const yieldAmt = Math.floor(deposit.amount * (elapsed / 86400) * 50);
      scene.playerStats.oromozi += deposit.amount + yieldAmt;
      scene.deposits.splice(index, 1);
      alert(`Withdrawn ${deposit.amount} units + ${yieldAmt} yield (simulated).`);
      updateHUD(scene);
      clearButtons(scene);
      showLiquidityPoolOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showLiquidityPoolOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select a deposit to withdraw:", options);
}

/* =======================================================
  
/* =======================================================
   5) MODULE MENUS FOR OTHER VILLAGE BUILDINGS
======================================================= */
// Full implementation of all village modules for compatibility

function showMerchantQuarterOptions(scene) {
  scene.narrativeScreen = SCREEN_MERCHANT;
  showModalOverlay(scene);
  const options = [
    {
      label: "List Item for Sale",
      callback: () => {
        clearButtons(scene);
        showListItemScreen(scene);
      }
    },
    {
      label: "Browse Marketplace",
      callback: () => {
        clearButtons(scene);
        showBrowseMarketplaceScreen(scene);
      }
    },
    {
      label: "View My Listed Items",
      callback: () => {
        clearButtons(scene);
        showMyListingsScreen(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    }
  ];
  createScrollableMenu(scene, "Merchant Quarter Options:\nSelect an option:", options);
}

function showListItemScreen(scene) {
  const resources = scene.localInventory;
  if (!resources || resources.length === 0) {
    alert("No items available to list.");
    showMerchantQuarterOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = resources.map((item, index) => ({
    label: `${item.name} x${item.quantity}`,
    callback: () => {
      clearButtons(scene);
      promptListItemDetails(scene, item, index);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showMerchantQuarterOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select an item to list for sale:", options);
}

function promptListItemDetails(scene, item, index) {
  clearButtons(scene);
  hideDialog(scene);
  let priceStr = prompt(`Enter sale price for ${item.name}:`, "1000");
  let price = parseInt(priceStr, 10);
  if (isNaN(price)) {
    alert("Invalid price. Returning to item selection.");
    showListItemScreen(scene);
    return;
  }
  let nonce = Date.now() + Math.floor(Math.random() * 1000);
  showDialog(scene, `List ${item.name} for sale at ${price} OROMOZI?\nConfirm listing?`);
  const options = [
    {
      label: "Yes",
      callback: async () => {
        const itemListed = scene.localInventory[index];
        scene.listedItems.push({ id: index, item: itemListed.name, quantity: 1, price, nonce });
        removeFromInventory(scene, item.name, 1);
        alert("Merchant listing created successfully (simulated).");
        clearButtons(scene);
        showMerchantQuarterOptions(scene);
      }
    },
    {
      label: "No",
      callback: () => {
        clearButtons(scene);
        showListItemScreen(scene);
      }
    }
  ];
  createButtons(scene, options);
}

function showBrowseMarketplaceScreen(scene) {
  const marketItems = [
    { item: "Iron Sword", price: 500 },
    { item: "Wooden Armor", price: 300 },
    { item: "Healing Potion", price: 100 }
  ];
  clearButtons(scene);
  const options = marketItems.map(item => ({
    label: `${item.item} - ${item.price} OROMOZI`,
    callback: async () => {
      if (scene.playerStats.oromozi >= item.price) {
        scene.playerStats.oromozi -= item.price;
        addToInventory(scene, item.item);
        alert(`Purchased ${item.item} for ${item.price} OROMOZI (simulated).`);
      } else {
        alert("Insufficient OROMOZI to purchase this item!");
      }
      updateHUD(scene);
      clearButtons(scene);
      showMerchantQuarterOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showMerchantQuarterOptions(scene);
    }
  });
  createScrollableMenu(scene, "Browse Marketplace:\nSelect an item to buy:", options);
}

function showMyListingsScreen(scene) {
  if (!scene.listedItems || scene.listedItems.length === 0) {
    alert("You have no listed items.");
    showMerchantQuarterOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = scene.listedItems.map((listing, index) => ({
    label: `${listing.item} x${listing.quantity} - ${listing.price} OROMOZI`,
    callback: () => {
      clearButtons(scene);
      showManageListingScreen(scene, listing, index);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showMerchantQuarterOptions(scene);
    }
  });
  createScrollableMenu(scene, "Your Listings:\nSelect an item to manage:", options);
}

function showManageListingScreen(scene, listing, index) {
  clearButtons(scene);
  const options = [
    {
      label: "Edit Price",
      callback: () => {
        clearButtons(scene);
        promptEditPrice(scene, listing, index);
      }
    },
    {
      label: "Cancel Listing",
      callback: async () => {
        addToInventory(scene, listing.item, listing.quantity);
        scene.listedItems.splice(index, 1);
        alert(`Listing for ${listing.item} cancelled (simulated).`);
        clearButtons(scene);
        showMerchantQuarterOptions(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        showMyListingsScreen(scene);
      }
    }
  ];
  createScrollableMenu(scene, `Manage ${listing.item} (${listing.price} OROMOZI):\nSelect an option:`, options);
}

function promptEditPrice(scene, listing, index) {
  clearButtons(scene);
  hideDialog(scene);
  let newPriceStr = prompt(`Enter new price for ${listing.item} (current: ${listing.price}):`, listing.price);
  let newPrice = parseInt(newPriceStr, 10);
  if (isNaN(newPrice)) {
    alert("Invalid price. Returning to listing options.");
    showManageListingScreen(scene, listing, index);
    return;
  }
  showDialog(scene, `Update ${listing.item} price to ${newPrice} OROMOZI?\nConfirm change?`);
  const options = [
    {
      label: "Yes",
      callback: async () => {
        scene.listedItems[index].price = newPrice;
        alert(`Listing price updated to ${newPrice} (simulated).`);
        clearButtons(scene);
        showMerchantQuarterOptions(scene);
      }
    },
    {
      label: "No",
      callback: () => {
        clearButtons(scene);
        showManageListingScreen(scene, listing, index);
      }
    }
  ];
  createButtons(scene, options);
}

function showRoyalMarketOptions(scene) {
  scene.narrativeScreen = SCREEN_ROYAL;
  showModalOverlay(scene);
  const categories = [
    { name: "Browse Weapons", items: [{ item: "Iron Sword", price: 500 }, { item: "Steel Axe", price: 700 }] },
    { name: "Resources", items: [{ item: "Wood", price: 50 }, { item: "Iron Ore", price: 100 }, { item: "Cloth", price: 50 }] },
    { name: "Consumables", items: [{ item: "Bread", price: 20 }, { item: "Healing Potion", price: 100 }] },
    { name: "Aesthetic Items", items: [{ item: "Fancy Hat", price: 200 }, { item: "Golden Necklace", price: 300 }] },
    { name: "Armor", items: [{ item: "Wooden Armor", price: 300 }, { item: "Iron Chestplate", price: 600 }] },
    { name: "Special Moves", items: [{ item: "Fireball", price: 1000 }, { item: "Stealth Strike", price: 1200 }] }
  ];
  const options = categories.map(cat => ({
    label: cat.name,
    callback: () => {
      clearButtons(scene);
      showRoyalCategoryScreen(scene, cat.name, cat.items);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      hideDialog(scene);
      hideModalOverlay(scene);
      scene.narrativeScreen = SCREEN_NONE;
    }
  });
  createScrollableMenu(scene, "Royal Market Options:\nSelect an option:", options);
}

function showRoyalCategoryScreen(scene, category, items) {
  clearButtons(scene);
  const options = items.map(item => ({
    label: `${item.item} - ${item.price} OROMOZI`,
    callback: async () => {
      let quantityStr = prompt(`How many ${item.item} would you like to buy? (1-99):`, "1");
      let quantity = parseInt(quantityStr, 10);
      
      if (isNaN(quantity) || quantity < 1 || quantity > 99) {
        alert("Invalid quantity. Please enter a number between 1 and 99.");
        return;
      }
      
      const totalCost = item.price * quantity;
      if (scene.playerStats.oromozi >= totalCost) {
        scene.playerStats.oromozi -= totalCost;
        addToInventory(scene, item.item, quantity);
        alert(`Purchased ${quantity} ${item.item} for ${totalCost} OROMOZI (simulated).`);
      } else {
        alert(`Insufficient OROMOZI! You need ${totalCost} OROMOZI for ${quantity} ${item.item}.`);
      }
      updateHUD(scene);
      clearButtons(scene);
      showRoyalMarketOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showRoyalMarketOptions(scene);
    }
  });
  createScrollableMenu(scene, `${category}:\nSelect an item to purchase:`, options);
}

function showTradingPostOptions(scene) {
  scene.narrativeScreen = SCREEN_TRADING;
  showModalOverlay(scene);
  const options = [
    {
      label: "Post an Item",
      callback: () => {
        clearButtons(scene);
        showTradePostItemScreen(scene);
      }
    },
    {
      label: "View Trade Listings",
      callback: () => {
        clearButtons(scene);
        showTradeListingsScreen(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    }
  ];
  createScrollableMenu(scene, "Trading Post Options:\nSelect an option:", options);
}

function showTradePostItemScreen(scene) {
  const resources = scene.localInventory;
  if (!resources || resources.length === 0) {
    alert("No items available to post.");
    showTradingPostOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = resources.map((item, index) => ({
    label: `${item.name} x${item.quantity}`,
    callback: () => {
      clearButtons(scene);
      promptTradeRequest(scene, item, index);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showTradingPostOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select an item to offer:", options);
}

function promptTradeRequest(scene, offerItem, offerIndex) {
  clearButtons(scene);
  const allLootItems = getAllLootItems(scene);
  const options = allLootItems.map(item => ({
    label: item,
    callback: async () => {
      scene.tradeListings.push({ offer: offerItem.name, quantity: 1, request: item });
      removeFromInventory(scene, offerItem.name, 1);
      alert(`Trade posted: ${offerItem.name} for ${item} (simulated).`);
      clearButtons(scene);
      showTradingPostOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showTradePostItemScreen(scene);
    }
  });
  createScrollableMenu(scene, `Select an item to request for ${offerItem.name}:`, options);
}

function showTradeListingsScreen(scene) {
  if (!scene.tradeListings || scene.tradeListings.length === 0) {
    alert("No trade listings available.");
    showTradingPostOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = scene.tradeListings.map((trade, index) => ({
    label: `${trade.offer} x${trade.quantity} for ${trade.request}`,
    callback: async () => {
      const offerItem = scene.localInventory.find(item => item.name === trade.request);
      if (offerItem && offerItem.quantity >= 1) {
        removeFromInventory(scene, trade.request, 1);
        addToInventory(scene, trade.offer, trade.quantity);
        scene.tradeListings.splice(index, 1);
        alert(`Trade accepted: Received ${trade.offer} for ${trade.request} (simulated).`);
      } else {
        alert(`You don't have ${trade.request} to trade!`);
      }
      clearButtons(scene);
      showTradingPostOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showTradingPostOptions(scene);
    }
  });
  createScrollableMenu(scene, "Trade Listings:\nSelect a trade to accept:", options);
}

function showTinkerersLabOptions(scene) {
  scene.narrativeScreen = SCREEN_TINKER;
  showModalOverlay(scene);
  const options = [
    {
      label: "Attempt to Invent",
      callback: () => {
        clearButtons(scene);
        showInventItemScreen(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    }
  ];
  createScrollableMenu(scene, "Tinkerer's Lab Options:\nSelect an option:", options);
}

function showInventItemScreen(scene) {
  const resources = scene.localInventory;
  if (!resources || resources.length < 3) {
    alert("You need at least 3 items to invent something.");
    showTinkerersLabOptions(scene);
    return;
  }
  clearButtons(scene);
  let selectedItems = [];
  const options = resources.map((item, index) => ({
    label: `${item.name} x${item.quantity}`,
    callback: () => {
      if (selectedItems.length < 3 && !selectedItems.includes(item.name)) {
        selectedItems.push(item.name);
        if (selectedItems.length === 3) {
          clearButtons(scene);
          confirmInvention(scene, selectedItems);
        } else {
          showDialog(scene, `Selected: ${selectedItems.join(", ")}\nSelect ${3 - selectedItems.length} more:`);
        }
      }
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showTinkerersLabOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select 3 items to attempt invention (click 3 times):", options);
}

function confirmInvention(scene, items) {
  clearButtons(scene);
  showDialog(scene, `Invent using ${items.join(", ")}?\nConfirm invention?`);
  const options = [
    {
      label: "Yes",
      callback: async () => {
        const secretRecipes = [
          { ingredients: ["Iron Ore", "Copper Ore", "Wood"], result: "Mechanical Cog" },
          { ingredients: ["Fire Crystal", "Steel Ingot", "Thread"], result: "Flamethrower Gadget" },
          { ingredients: ["Vines", "Stone", "Herbs"], result: "Vine Trap" },
          { ingredients: ["Poisonous Berries", "Water", "Iron Ore"], result: "Toxic Sprayer" },
          { ingredients: ["Wood", "Thread", "Copper Ore"], result: "Wind-Up Toy" },
          { ingredients: ["Steel Ingot", "Fire Crystal", "Wood"], result: "Steam Pistol" },
          { ingredients: ["Leather", "Iron Ore", "Vines"], result: "Spring-Loaded Glove" }
        ];

        items.sort();
        const match = secretRecipes.find(recipe => {
          const sortedRecipe = [...recipe.ingredients].sort();
          return items.length === sortedRecipe.length && items.every((item, i) => item === sortedRecipe[i]);
        });

        const hasItems = items.every(item => {
          const invItem = scene.localInventory.find(i => i.name === item);
          return invItem && invItem.quantity >= 1;
        });

        if (hasItems) {
          items.forEach(item => removeFromInventory(scene, item));
          if (match) {
            const newItem = match.result;
            addToInventory(scene, newItem);
            alert(`Invention succeeded! Created ${newItem} (simulated).`);
          } else {
            alert("Invention failed! Items consumed (simulated).");
          }
        } else {
          alert("You don't have all the required items!");
        }
        clearButtons(scene);
        showTinkerersLabOptions(scene);
      }
    },
    {
      label: "No",
      callback: () => {
        clearButtons(scene);
        showInventItemScreen(scene);
      }
    }
  ];
  createButtons(scene, options);
}

function showCraftingWorkshopOptions(scene) {
  // First, clean up any existing UI elements
  hideDialog(scene);
  clearButtons(scene);
  
  // Set the screen type
  scene.narrativeScreen = SCREEN_CRAFT;
  showModalOverlay(scene);
  
  const options = [
    {
      label: "Craft Item",
      callback: () => {
        clearButtons(scene);
        showCraftItemScreen(scene);
      }
    },
    {
      label: "Repair Item",
      callback: () => {
        clearButtons(scene);
        showRepairItemScreen(scene);
      }
    },
    {
      label: "Salvage Loot",
      callback: () => {
        clearButtons(scene);
        showSalvageItemScreen(scene);
      }
    },
    {
      label: "Back",
      callback: () => {
        clearButtons(scene);
        hideDialog(scene);
        hideModalOverlay(scene);
        scene.narrativeScreen = SCREEN_NONE;
      }
    }
  ];
  createScrollableMenu(scene, "Crafting Workshop Options:\nSelect an option:", options);
}

function showCraftItemScreen(scene) {
  // First, properly clean up any existing dialog and menu elements
  hideDialog(scene);
  clearButtons(scene);
  
  // If the previous menu's title or instructions are still visible, destroy them
  if (scene.menuTitleText) {
    scene.menuTitleText.destroy();
    scene.menuTitleText = null;
  }
  
  if (scene.menuInstructionsText) {
    scene.menuInstructionsText.destroy();
    scene.menuInstructionsText = null;
  }
  
  if (scene.dialogTitleText) {
    scene.dialogTitleText.destroy();
    scene.dialogTitleText = null;
  }
  
  const recipes = [
    { result: "Iron Sword", ingredients: ["Iron Ore", "Wood"], description: "A sturdy blade for combat." },
    { result: "Wooden Armor", ingredients: ["Wood", "Wood"], description: "Basic protection from the wilds." },
    { result: "Steel Axe", ingredients: ["Steel Ingot", "Wood"], description: "Chops trees and foes alike." },
    { result: "Leather Boots", ingredients: ["Leather", "Thread"], description: "Swift and silent footwear." },
    { result: "Healing Salve", ingredients: ["Herbs", "Water"], description: "Restores minor wounds." },
    { result: "Poison Dagger", ingredients: ["Iron Ore", "Poisonous Berries"], description: "A sneaky, toxic blade." },
    { result: "Stone Hammer", ingredients: ["Stone", "Wood"], description: "Good for breaking rocks." },
    { result: "Copper Ring", ingredients: ["Copper Ore", "Thread"], description: "A shiny trinket." },
    { result: "Fire Staff", ingredients: ["Wood", "Fire Crystal"], description: "Channels fiery magic." },
    { result: "Shield of Roots", ingredients: ["Wood", "Vines"], description: "Nature's sturdy defense." }
  ];
  
  console.log("Player inventory:", scene.localInventory);
  
  // Show inventory message to make it clear what resources the player has
  let inventoryText = "Current Materials:\n";
  const craftingMaterials = ["Wood", "Iron Ore", "Steel Ingot", "Leather", "Thread", 
                           "Herbs", "Water", "Poisonous Berries", "Stone", "Copper Ore", 
                           "Fire Crystal", "Vines"];
  
  craftingMaterials.forEach(material => {
    const item = scene.localInventory.find(i => i.name === material);
    if (item) {
      inventoryText += `${material}: ${item.quantity}\n`;
    }
  });
  
  // Show a notification about what materials the player has
  alert(inventoryText);
  
  // Create our own menu with direct highlighting
  const boxW = 300; // Increased width
  const boxH = 250; // Increased height
  const boxX = (scene.game.config.width - boxW) / 2;
  const boxY = (scene.game.config.height - boxH) / 2;
  
  // Create dialog background
  scene.dialogBg.clear();
  scene.dialogBg.fillStyle(0x000000, 0.8);
  scene.dialogBg.fillRect(boxX, boxY, boxW, boxH);
  scene.dialogBg.lineStyle(2, 0xffffff, 1);
  scene.dialogBg.strokeRect(boxX, boxY, boxW, boxH);
  
  // Add a separator line between title and options
  scene.dialogBg.lineStyle(1, 0xaaaaaa, 0.7);
  scene.dialogBg.lineBetween(boxX + 10, boxY + 60, boxX + boxW - 10, boxY + 60);
  
  // Make dialog visible
  scene.dialogBg.setVisible(true);
  
  // Set up scroll state for this menu
  const maxVisible = 6; // Show at most 6 recipes at once
  let scrollIndex = 0;
  
  // Create title text
  const titleText = scene.add.text(
    boxX + boxW/2, 
    boxY + 20, 
    "Select an item to craft:", 
    {
      font: "16px Arial",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: boxW - 40 }
    }
  );
  titleText.setOrigin(0.5, 0);
  titleText.setDepth(1601);
  titleText.setScrollFactor(0);
  scene.buttons.push(titleText);
  
  // Add instructions text below separator line
  const instructionsText = scene.add.text(
    boxX + boxW/2, 
    boxY + 65, 
    "(Yellow items can be crafted - Use UP/DOWN to scroll)", 
    {
      font: "12px Arial",
      fill: "#cccccc",
      stroke: "#000000",
      strokeThickness: 1,
      align: "center"
    }
  );
  instructionsText.setOrigin(0.5, 0);
  instructionsText.setDepth(1601);
  instructionsText.setScrollFactor(0);
  scene.buttons.push(instructionsText);
  
  // Function to update the displayed recipes based on scroll position
  const updateRecipeDisplay = () => {
    // Clear previous recipe buttons
    scene.buttons = scene.buttons.filter(button => {
      if (button._recipeButton) {
        button.destroy();
        return false;
      }
      return true;
    });
    
    // Show scroll indicators if needed
    if (scene.upArrow) {
      scene.upArrow.destroy();
      scene.upArrow = null;
    }
    
    if (scene.downArrow) {
      scene.downArrow.destroy();
      scene.downArrow = null;
    }
    
    if (scrollIndex > 0) {
      scene.upArrow = scene.add.text(boxX + boxW - 20, boxY + 70, "▲", { 
        font: "16px Arial", 
        fill: "#ffffff" 
      }).setDepth(1601).setScrollFactor(0);
      scene.buttons.push(scene.upArrow);
    }
    
    if (scrollIndex + maxVisible < recipes.length) {
      scene.downArrow = scene.add.text(boxX + boxW - 20, boxY + boxH - 20, "▼", { 
        font: "16px Arial", 
        fill: "#ffffff" 
      }).setDepth(1601).setScrollFactor(0);
      scene.buttons.push(scene.downArrow);
    }
    
    // Get the slice of recipes to display
    const visibleRecipes = recipes.slice(scrollIndex, scrollIndex + maxVisible);
    
    // Create recipe buttons
    let yOffset = 90; // Adjusted to account for the instructions text
    visibleRecipes.forEach((recipe, index) => {
      // Check if player has all ingredients
      const canCraft = recipe.ingredients.every(ing => {
        // Count how many of this ingredient are needed
        const needed = recipe.ingredients.filter(i => i === ing).length;
        // Check if player has enough
        const playerItem = scene.localInventory.find(i => i.name === ing);
        const hasEnough = playerItem && playerItem.quantity >= needed;
        
        return hasEnough;
      });
      
      // Create button text with conditional highlight
      const buttonText = scene.add.text(
        boxX + 20, // Increased indent
        boxY + yOffset + (index * 25), // Increased spacing between items
        `${recipe.result} (${recipe.ingredients.join(", ")})`, 
        {
          font: "14px Arial",
          fill: canCraft ? "#ffff00" : "#ffffff", // Yellow for craftable items
          stroke: "#000000",
          strokeThickness: 2
        }
      );
      
      buttonText._recipeButton = true; // Mark as a recipe button for cleanup
      buttonText._recipeIndex = scrollIndex + index; // Store the actual recipe index
      
      buttonText.setDepth(1601);
      buttonText.setScrollFactor(0);
      buttonText.setInteractive({ useHandCursor: true });
      
      // Add button effects
      buttonText.on("pointerover", () => {
        buttonText.setStyle({ fill: "#ff9900" }); // Orange on hover
      });
      
      buttonText.on("pointerout", () => {
        buttonText.setStyle({ fill: canCraft ? "#ffff00" : "#ffffff" }); // Return to yellow or white
      });
      
      buttonText.on("pointerdown", () => {
        clearButtons(scene);
        confirmCraftItem(scene, recipes[buttonText._recipeIndex]);
      });
      
      scene.buttons.push(buttonText);
    });
  };
  
  // Initial display of recipes
  updateRecipeDisplay();
  
  // Add back button
  const backButton = scene.add.text(
    boxX + boxW/2, 
    boxY + boxH - 30, 
    "Back", 
    {
      font: "14px Arial",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }
  );
  
  backButton.setOrigin(0.5);
  backButton.setDepth(1601);
  backButton.setScrollFactor(0);
  backButton.setInteractive({ useHandCursor: true });
  
  backButton.on("pointerover", () => {
    backButton.setStyle({ fill: "#ff9900" });
  });
  
  backButton.on("pointerout", () => {
    backButton.setStyle({ fill: "#ffffff" });
  });
  
  backButton.on("pointerdown", () => {
    // Remove scroll listeners when going back
    scene.input.keyboard.off("keydown-UP");
    scene.input.keyboard.off("keydown-DOWN");
    
    clearButtons(scene);
    showCraftingWorkshopOptions(scene);
  });
  
  scene.buttons.push(backButton);
  
  // Set up keyboard controls for scrolling
  scene.input.keyboard.off("keydown-UP");
  scene.input.keyboard.off("keydown-DOWN");
  
  scene.input.keyboard.on("keydown-UP", () => {
    if (scrollIndex > 0) {
      scrollIndex--;
      updateRecipeDisplay();
    }
  });
  
  scene.input.keyboard.on("keydown-DOWN", () => {
    if (scrollIndex + maxVisible < recipes.length) {
      scrollIndex++;
      updateRecipeDisplay();
    }
  });
}

function confirmCraftItem(scene, recipe) {
  // Count how many of each ingredient is needed
  const ingredientCounts = {};
  recipe.ingredients.forEach(ing => {
    ingredientCounts[ing] = (ingredientCounts[ing] || 0) + 1;
  });
  
  // Check if player has enough of each ingredient
  const hasIngredients = Object.entries(ingredientCounts).every(([ing, count]) => {
    const playerItem = scene.localInventory.find(i => i.name === ing);
    return playerItem && playerItem.quantity >= count;
  });
  
  if (!hasIngredients) {
    alert(`You don't have all required ingredients: ${recipe.ingredients.join(", ")}`);
    showCraftingWorkshopOptions(scene);
    return;
  }
  
  showDialog(scene, `Craft ${recipe.result} using ${recipe.ingredients.join(", ")}?\n${recipe.description}\nConfirm crafting?`);
  const options = [
    {
      label: "Yes",
      callback: async () => {
        // Remove ingredients, accounting for duplicates
        Object.entries(ingredientCounts).forEach(([item, count]) => {
          removeFromInventory(scene, item, count);
        });
        
        addToInventory(scene, recipe.result);
        alert(`Crafted ${recipe.result}!`);
        clearButtons(scene);
        showCraftingWorkshopOptions(scene);
      }
    },
    {
      label: "No",
      callback: () => {
        clearButtons(scene);
        showCraftItemScreen(scene);
      }
    }
  ];
  createButtons(scene, options);
}

function showRepairItemScreen(scene) {
  const resources = scene.localInventory;
  if (!resources || resources.length === 0) {
    alert("No items available to repair.");
    showCraftingWorkshopOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = resources.map((item, index) => ({
    label: `${item.name} x${item.quantity}`,
    callback: async () => {
      const resourceItem = scene.localInventory.find(i => i.name === "Wood");
      if (resourceItem && resourceItem.quantity >= 1) {
        removeFromInventory(scene, "Wood");
        alert(`Repaired ${scene.localInventory[index].name} (simulated).`);
      } else {
        alert(`You don't have Wood to repair this item!`);
      }
      clearButtons(scene);
      showCraftingWorkshopOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showCraftingWorkshopOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select an item to repair (requires Wood):", options);
}

function showSalvageItemScreen(scene) {
  const resources = scene.localInventory;
  if (!resources || resources.length === 0) {
    alert("No items available to salvage.");
    showCraftingWorkshopOptions(scene);
    return;
  }
  clearButtons(scene);
  const options = resources.map((item, index) => ({
    label: `${item.name} x${item.quantity}`,
    callback: async () => {
      const salvage = getRandomLootForZone(scene);
      removeFromInventory(scene, item.name, 1);
      addToInventory(scene, salvage);
      alert(`Salvaged ${item.name} into ${salvage}.`);
      clearButtons(scene);
      showCraftingWorkshopOptions(scene);
    }
  }));
  options.push({
    label: "Back",
    callback: () => {
      clearButtons(scene);
      showCraftingWorkshopOptions(scene);
    }
  });
  createScrollableMenu(scene, "Select an item to salvage:", options);
}

/* =======================================================
   6) VILLAGE CONTRACT INTERACTION HANDLER
======================================================= */
function handleVillageContractInteraction(scene, obj) {
  console.log("Village contract interaction triggered for:", obj.name);
  
  // Visual feedback for interaction
  if (scene.player) {
    createSimpleEffect(scene, scene.player.x, scene.player.y, 0x00ffff);
  }
  
  switch (obj.name.toLowerCase()) {
    case "trading_post":
      showTradingPostOptions(scene);
      break;
    case "crafting_workshop":
      // Add crafting materials directly when accessing the crafting workshop
      const craftingMaterials = [
        { name: "Wood", quantity: 5 },
        { name: "Iron Ore", quantity: 2 },
        { name: "Stone", quantity: 3 },
        { name: "Herbs", quantity: 2 },
        { name: "Water", quantity: 2 },
        { name: "Vines", quantity: 1 },
        { name: "Thread", quantity: 2 },
        { name: "Leather", quantity: 1 }
      ];
      
      // Add each material to inventory
      craftingMaterials.forEach(material => {
        const existingItem = scene.localInventory.find(item => item.name === material.name);
        if (existingItem) {
          existingItem.quantity = Math.max(existingItem.quantity, material.quantity);
        } else {
          scene.localInventory.push({ name: material.name, quantity: material.quantity });
        }
      });
      
      console.log("Added crafting materials to inventory:", scene.localInventory);
      addToLog(scene, "Received crafting materials!");
      
      showCraftingWorkshopOptions(scene);
      break;
    case "liquidity_bank":
      showLiquidityPoolOptions(scene);
      break;
    case "merchant_quarter":
      showMerchantQuarterOptions(scene);
      break;
    case "royal_market":
      showRoyalMarketOptions(scene);
      break;
    case "tinkerers_lab":
      showTinkerersLabOptions(scene);
      break;
    case "dungeon_entrance":
      handleDungeonEntrance(scene);
      break;
    case "scavenger_mode":
      console.log("Entering Scavenger Mode...");
      showDialog(scene, "Enter Scavenger Mode with your current inventory?\n(Press SPACE to confirm)");
      scene.input.keyboard.once("keydown-SPACE", () => {
        const targetZone = zoneList.find(z => z.name === "Outer Grasslands");
        if (targetZone) {
          // Add transition effect
          scene.cameras.main.fadeOut(500);
          scene.time.delayedCall(500, () => {
            const currentOromozi = scene.playerStats.oromozi;
            scene.playerStats = createInitialStats(targetZone.name, currentOromozi);
            scene.scene.restart({ zone: targetZone, inventory: scene.localInventory, promptCount: scene.promptCount });
          });
        } else {
          console.warn("Outer Grasslands zone not found!");
        }
      });
      break;
    case "camping_mode":
      console.log("Entering Camping Mode...");
      const gameTime = scene.registry.get('gameTime');
      const gameHour = (6 + Math.floor(gameTime / scene.secondsPerHour)) % 24;
      const isNearNight = gameHour >= 18 && gameHour < 20;
      const isNight = gameHour >= 20 || gameHour < 6;
      
      if (isNearNight || isNight) {
        showDialog(scene, `It's ${isNearNight ? "getting dark" : "night"}, do you want to set up camp?\n(Press SPACE to confirm)`);
        scene.input.keyboard.once("keydown-SPACE", () => {
          if (hasCampingMaterials(scene)) {
            initiateCampingSetup(scene);
          } else {
            showDialog(scene, "You need 2 sticks and 1 cloth to set up camp.\n(Press SPACE to continue)");
            scene.input.keyboard.once("keydown-SPACE", () => {
              hideDialog(scene);
            });
          }
        });
      } else {
        showDialog(scene, "You can only set up camp during near-night (6:00 PM - 8:00 PM) or night (8:00 PM - 6:00 AM).\n(Press SPACE to continue)");
        scene.input.keyboard.once("keydown-SPACE", () => {
          hideDialog(scene);
        });
      }
      break;
  }
}

function handleDungeonEntrance(scene) {
  // Check if player has a dungeon key
  const dungeonKey = scene.localInventory.find(item => item.name === "Dungeon Key");
  
  if (dungeonKey && dungeonKey.quantity > 0) {
    showDialog(scene, "Use Dungeon Key to enter the ancient dungeon?\n(Press SPACE to confirm)");
    
    scene.input.keyboard.once("keydown-SPACE", () => {
      // Remove one key from inventory
      removeFromInventory(scene, "Dungeon Key", 1);
      
      // Add visual effect for key use
      createSimpleEffect(scene, scene.player.x, scene.player.y, 0x8800ff);
      
      // Add log message
      addToLog(scene, "Used Dungeon Key");
      
      // Transition to dungeon scene with fade effect
      scene.cameras.main.fadeOut(500);
      scene.time.delayedCall(500, () => {
        // Start the DungeonScene and pass current inventory and player stats
        scene.scene.start("DungeonScene", {
          inventory: scene.localInventory,
          playerStats: scene.playerStats,
          returnScene: scene.currentZone
        });
      });
    });
  } else {
    showDialog(scene, "You need a Dungeon Key to enter. These can be found while exploring the Outer Grasslands.\n(Press SPACE to continue)");
    
    scene.input.keyboard.once("keydown-SPACE", () => {
      hideDialog(scene);
    });
  }
}

/* =======================================================
   7) SCENE LOOT CRATE AND EXCLAMATION SPAWNING FUNCTIONS (IMPROVED)
======================================================= */
function spawnOneLootCrate(scene) {
  const MAX_TRIES = 100;
  let tries = 0;
  const worldW = scene.background.displayWidth;
  const worldH = scene.background.displayHeight;
  
  // Increased minimum distance from edges for better visibility
  const edgeBuffer = 80;
  
  while (tries < MAX_TRIES) {
    tries++;
    const crateX = Phaser.Math.Between(edgeBuffer, worldW - edgeBuffer);
    const crateY = Phaser.Math.Between(edgeBuffer, worldH - edgeBuffer);
    
    // Improved collision detection with better buffer zone
    if (!overlapsObstacle(scene, crateX, crateY, 80)) {
      const crate = scene.lootCrates.create(crateX, crateY, "loot_crate");
      crate.setOrigin(0.5, 0.5);
      crate.setFrame(0); // Initial frame (intact crate)
      crate.setScale(1);
      crate.setDepth(900);
      crate.setImmovable(true);
      
      // Health varies by zone and player level
      const minHealth = 2 + Math.floor((scene.playerStats.level - 1) * 0.5);
      const maxHealth = 6 + Math.floor((scene.playerStats.level - 1) * 0.8);
      const health = Phaser.Math.Between(minHealth, maxHealth);
      
      // Simple tint instead of glow effect for compatibility
      crate.setTint(0xffff77);
      
      crate.setData('health', health);
      crate.setData('breaking', false);
      crate.body.setSize(64, 64);
      crate.body.setOffset(0, 0);
      
      // Add a small animation to make crates stand out
      scene.tweens.add({
        targets: crate,
        y: crateY - 5,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      console.log("Crate spawned at:", crateX, crateY, "with health:", health);
      return;
    }
  }
  console.warn("Unable to place loot crate after", MAX_TRIES, "tries.");
}

function spawnMultipleLootCrates(scene, count) {
  if (scene.currentZone === "Village") return;
  
  // Scale crate count with player level for progression
  const baseCount = count;
  const levelBonus = Math.floor((scene.playerStats.level - 1) * 0.5);
  const totalCrates = baseCount + levelBonus;
  
  for (let i = 0; i < totalCrates; i++) {
    spawnOneLootCrate(scene);
  }
}

function spawnOneExclamation(scene) {
  const MAX_TRIES = 100;
  let tries = 0;
  const worldW = scene.background.displayWidth;
  const worldH = scene.background.displayHeight;
  
  // Better placement buffer
  const edgeBuffer = 100;
  const minDistanceFromPlayer = 150;
  
  while (tries < MAX_TRIES) {
    tries++;
    const exX = Phaser.Math.Between(edgeBuffer, worldW - edgeBuffer);
    const exY = Phaser.Math.Between(edgeBuffer, worldH - edgeBuffer);
    
    // Check distance from player
    if (scene.player) {
      const playerDist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, exX, exY);
      if (playerDist < minDistanceFromPlayer) continue;
    }
    
    if (!overlapsObstacle(scene, exX, exY, 50)) {
      const ex = scene.exclamations.create(exX, exY, "exclamation");
      ex.setScale(bgScale * 4);
      ex.setDepth(900);
      ex.setImmovable(true);
      
      // Add pulsing animation to draw attention
      scene.tweens.add({
        targets: ex,
        scale: bgScale * 4.5,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      // Simple yellow tint instead of glow
      ex.setTint(0xffff00);
      
      return;
    }
  }
  console.warn("Unable to place exclamation after", MAX_TRIES, "tries.");
}

function spawnMultipleExclamations(scene, count) {
  // Completely abort if scene isn't fully initialized
  if (!scene || !scene.add || !scene.sys || !scene.sys.displayList) {
    console.error("Scene not ready for spawning exclamations - missing core components");
    return;
  }
  
  if (scene.currentZone === "Village") return;
  
  // Scale exclamation count based on player progress
  const totalExclamations = count + Math.floor((scene.promptCount || 0) / 5);
  const actualCount = Math.min(totalExclamations, 6); // Reduce count to prevent overload
  
  console.log(`Attempting to spawn ${actualCount} exclamations`);
  
  // Use safer loop with try/catch
  for (let i = 0; i < actualCount; i++) {
    try {
      createClickableExclamation(scene);
    } catch (error) {
      console.error("Error spawning exclamation:", error);
    }
  }
}

// Improved collision detection with customizable buffer and more forgiving checks
function overlapsObstacle(scene, x, y, buffer = 64) {
  if (!scene || !scene.obstacles) return false;
  
  const halfBuffer = buffer / 2;
  const rect = new Phaser.Geom.Rectangle(x - halfBuffer, y - halfBuffer, buffer, buffer);
  
  try {
    const obstacles = scene.obstacles.getChildren();
    if (!obstacles || !Array.isArray(obstacles)) return false;
    
    for (let obs of obstacles) {
      if (!obs || !obs.getBounds) continue;
      
      // Add a smaller margin around obstacles for better navigation
      const margin = 5; // Reduced from 10
      const obsBounds = obs.getBounds();
      const expandedBounds = new Phaser.Geom.Rectangle(
        obsBounds.x - margin,
        obsBounds.y - margin,
        obsBounds.width + margin * 2,
        obsBounds.height + margin * 2
      );
      
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, expandedBounds)) {
        return true;
      }
    }
  } catch (error) {
    console.warn("Error in collision detection:", error);
    return false;
  }
  
  // Also check for proximity to other objects of the same type
  // but with a smaller minimum distance
  const minDistance = buffer * 1.2; // Reduced from 1.5
  
  if (scene.lootCrates) {
    try {
      const crates = scene.lootCrates.getChildren();
      if (crates && Array.isArray(crates)) {
        for (let crate of crates) {
          if (!crate || !crate.x) continue;
          const dist = Phaser.Math.Distance.Between(x, y, crate.x, crate.y);
          if (dist < minDistance) return true;
        }
      }
    } catch (e) {
      console.warn("Error checking crate overlaps:", e);
    }
  }
  
  if (scene.exclamations) {
    try {
      const exs = scene.exclamations.getChildren();
      if (exs && Array.isArray(exs)) {
        for (let ex of exs) {
          if (!ex || !ex.x) continue;
          const dist = Phaser.Math.Distance.Between(x, y, ex.x, ex.y);
          if (dist < minDistance) return true;
        }
      }
    } catch (e) {
      console.warn("Error checking exclamation overlaps:", e);
    }
  }
  
  return false;
}

/* =/* =======================================================
   8) HELPER UI FUNCTIONS (IMPROVED)
======================================================= */
function showDialog(scene, text) {
  const boxW = 300; // Increased width
  const boxH = 200; // Keep this height for general dialogs
  const boxX = (scene.game.config.width - boxW) / 2;
  const boxY = (scene.game.config.height - boxH) / 2;
  
  scene.dialogBg.clear();
  scene.dialogBg.fillStyle(0x000000, 0.8);
  scene.dialogBg.fillRect(boxX, boxY, boxW, boxH);
  scene.dialogBg.lineStyle(2, 0xffffff, 1);
  scene.dialogBg.strokeRect(boxX, boxY, boxW, boxH);
  
  // Add a subtle header area
  if (text && text.length > 0) {
    scene.dialogBg.fillStyle(0x333333, 0.5);
    scene.dialogBg.fillRect(boxX, boxY, boxW, 30);
    
    // Add a separator line below the header
    scene.dialogBg.lineStyle(1, 0xaaaaaa, 0.7);
    scene.dialogBg.lineBetween(boxX, boxY + 30, boxX + boxW, boxY + 30);
  }
  
  scene.dialogText.setPosition(boxX + boxW/2, boxY + 20);
  
  // Check if the text contains a title section (before newlines)
  let titleText = "";
  let bodyText = text;
  
  if (text && text.includes("\n")) {
    const parts = text.split("\n");
    titleText = parts[0];
    bodyText = parts.slice(1).join("\n");
    
    // Create separate text objects for title and body for better styling
    if (scene.dialogTitleText) {
      scene.dialogTitleText.destroy();
    }
    
    scene.dialogTitleText = scene.add.text(
      boxX + boxW/2,
      boxY + 15,
      titleText,
      {
        font: "16px Arial",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center"
      }
    );
    scene.dialogTitleText.setOrigin(0.5, 0.5);
    scene.dialogTitleText.setDepth(1601);
    scene.dialogTitleText.setScrollFactor(0);
    
    // Set the body text
    scene.dialogText.setText(bodyText);
    scene.dialogText.setPosition(boxX + 15, boxY + 45);
    scene.dialogText.setOrigin(0, 0);
  } else {
    // Just regular text with centered alignment
    scene.dialogText.setText(text);
    scene.dialogText.setOrigin(0.5, 0);
  }
  
  scene.dialogText.setStyle({
    font: "14px Arial",
    fill: "#ffffff",
    wordWrap: { width: boxW - 30 },
    stroke: "#000000",
    strokeThickness: 2
  });
  
  scene.dialogBg.setVisible(true);
  scene.dialogText.setVisible(true);
  scene.dialogBg.setScrollFactor(0);
  scene.dialogText.setScrollFactor(0);
  scene.dialogBg.setDepth(1600);
  scene.dialogText.setDepth(1601);
}

function hideDialog(scene) {
  scene.dialogBg.clear();
  scene.dialogBg.setVisible(false);
  scene.dialogText.setVisible(false);
  
  // Clean up additional dialog elements
  if (scene.dialogTitleText) {
    scene.dialogTitleText.setVisible(false);
  }
  
  if (scene.menuTitleText) {
    scene.menuTitleText.setVisible(false);
  }
  
  if (scene.menuInstructionsText) {
    scene.menuInstructionsText.setVisible(false);
  }
  
  // Clean up scroll arrows
  if (scene.upArrow) {
    scene.upArrow.destroy();
    scene.upArrow = null;
  }
  
  if (scene.downArrow) {
    scene.downArrow.destroy();
    scene.downArrow = null;
  }
  
  // Remove keyboard listeners for scrolling
  scene.input.keyboard.off("keydown-UP");
  scene.input.keyboard.off("keydown-DOWN");
  
  updateHUD(scene);
}

function createButtons(scene, lines) {
  clearButtons(scene);
  const boxW = 300; // Match the new dialog box width
  const boxH = 200;
  const boxX = (scene.game.config.width - boxW) / 2;
  const boxY = (scene.game.config.height - boxH) / 2;
  
  // Calculate the number of buttons and their placement
  const totalButtons = lines.length;
  const buttonSpacing = 30; // Vertical spacing between buttons
  const buttonWidth = 120; // Fixed width for buttons for consistent appearance
  
  // Calculate starting Y position to center buttons vertically in the lower half
  const startY = boxY + boxH - (totalButtons * buttonSpacing) - 20;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Create button with background
    const buttonBg = scene.add.graphics();
    buttonBg.fillStyle(0x333333, 0.7);
    buttonBg.fillRoundedRect(
      boxX + boxW/2 - buttonWidth/2, 
      startY + i * buttonSpacing - 10, 
      buttonWidth, 
      25, 
      5
    );
    buttonBg.lineStyle(1, 0x666666, 0.8);
    buttonBg.strokeRoundedRect(
      boxX + boxW/2 - buttonWidth/2, 
      startY + i * buttonSpacing - 10, 
      buttonWidth, 
      25, 
      5
    );
    buttonBg.setDepth(1601);
    buttonBg.setScrollFactor(0);
    scene.buttons.push(buttonBg);
    
    // Create button text
    const txt = scene.add.text(
      boxX + boxW/2, 
      startY + i * buttonSpacing, 
      line.label, 
      { 
        font: "14px Arial", 
        fill: "#ffff00",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center"
      }
    );
    
    txt.setOrigin(0.5, 0.5);
    txt.setDepth(1602);
    txt.setInteractive({ useHandCursor: true });
    
    // Add button effects
    txt.on("pointerover", () => {
      txt.setStyle({ fill: "#ff9900" });
      buttonBg.clear();
      buttonBg.fillStyle(0x555555, 0.8);
      buttonBg.fillRoundedRect(
        boxX + boxW/2 - buttonWidth/2, 
        startY + i * buttonSpacing - 10, 
        buttonWidth, 
        25, 
        5
      );
      buttonBg.lineStyle(1, 0x888888, 0.9);
      buttonBg.strokeRoundedRect(
        boxX + boxW/2 - buttonWidth/2, 
        startY + i * buttonSpacing - 10, 
        buttonWidth, 
        25, 
        5
      );
    });
    
    txt.on("pointerout", () => {
      txt.setStyle({ fill: "#ffff00" });
      buttonBg.clear();
      buttonBg.fillStyle(0x333333, 0.7);
      buttonBg.fillRoundedRect(
        boxX + boxW/2 - buttonWidth/2, 
        startY + i * buttonSpacing - 10, 
        buttonWidth, 
        25, 
        5
      );
      buttonBg.lineStyle(1, 0x666666, 0.8);
      buttonBg.strokeRoundedRect(
        boxX + boxW/2 - buttonWidth/2, 
        startY + i * buttonSpacing - 10, 
        buttonWidth, 
        25, 
        5
      );
    });
    
    txt.on("pointerdown", () => {
      txt.setStyle({ fill: "#ffffff" });
      scene.time.delayedCall(100, line.callback);
    });
    
    scene.buttons.push(txt);
    txt.setScrollFactor(0);
  }
}

function clearButtons(scene) {
  scene.buttons.forEach(btn => btn.destroy());
  scene.buttons = [];
}

function getOverlappingExclamation(scene) {
  // First check exclamation physics group
  if (scene.exclamations && scene.player) {
    try {
      const playerRect = scene.player.getBounds();
      const exList = scene.exclamations.getChildren();
      
      for (let ex of exList) {
        if (!ex || !ex.getBounds) continue;
        
        if (Phaser.Geom.Intersects.RectangleToRectangle(playerRect, ex.getBounds())) {
          return ex;
        }
      }
    } catch (error) {
      console.warn("Error checking exclamation overlaps:", error);
    }
  }
  
  // Then check sprite array if it exists
  if (scene.exclamationSprites && scene.exclamationSprites.length > 0 && scene.player) {
    try {
      const playerRect = scene.player.getBounds();
      
      for (let ex of scene.exclamationSprites) {
        if (!ex || !ex.getBounds) continue;
        
        if (Phaser.Geom.Intersects.RectangleToRectangle(playerRect, ex.getBounds())) {
          return ex;
        }
      }
    } catch (error) {
      console.warn("Error checking sprite exclamation overlaps:", error);
    }
  }
  
  return null;
}

function endFlow(scene) {
  scene.narrativeScreen = SCREEN_NONE;
  scene.activePrompt = null;
  scene.chosenOptionIndex = -1;
  hideDialog(scene);
  console.log("Narrative flow ended.");
  updateHUD(scene);
  scene.promptCount++;
  console.log("Prompt count:", scene.promptCount);
}

/* =======================================================
   9) NARRATIVE FLOW FUNCTIONS
======================================================= */
function showPrologue(scene) {
  const zone = scene.currentZone;
  const prologues = scene.narrativePrologues?.[zone];
  if (!prologues || prologues.length === 0) {
    console.log("No prologues for zone:", zone);
    scene.narrativeScreen = SCREEN_PROMPT;
    showPrompt(scene);
    return;
  }
  const text = prologues[Phaser.Math.Between(0, prologues.length - 1)];
  showDialog(scene, text + "\n\n(Press SPACE to continue)");
}

function showPrompt(scene) {
  const zone = scene.currentZone;
  const prompts = scene.narrativeData?.zones?.[zone];
  if (!prompts || prompts.length === 0) {
    console.warn("No prompts for zone:", zone);
    hideDialog(scene);
    scene.narrativeScreen = SCREEN_NONE;
    return;
  }
  
  // Add variation to prompts based on time of day
  const gameTime = scene.registry.get('gameTime');
  const gameHour = (6 + Math.floor(gameTime / scene.secondsPerHour)) % 24;
  const timeOfDay = gameHour < 12 ? "morning" : (gameHour < 18 ? "afternoon" : "evening");
  
  // Filter prompts that match current time of day if available
  const timePrompts = prompts.filter(p => p.timeOfDay === timeOfDay);
  const availablePrompts = timePrompts.length > 0 ? timePrompts : prompts;
  
  const randIndex = Phaser.Math.Between(0, availablePrompts.length - 1);
  scene.activePrompt = availablePrompts[randIndex];
  
  showDialog(scene, `--- ${zone} (${timeOfDay}) ---\n\n${scene.activePrompt.prompt}\n\n(Press SPACE to see choices)`);
}

function showChoices(scene) {
  if (!scene.activePrompt) return;
  showDialog(scene, "Pick one choice:");
  const lines = scene.activePrompt.options.map((opt, i) => ({
    label: opt,
    callback: () => {
      scene.chosenOptionIndex = i;
      scene.narrativeScreen = SCREEN_OUTCOME;
      showOutcome(scene);
    }
  }));
  
  // Add travel options after enough exploration
  if (scene.promptCount >= 8) {
    let extraOption = null;
    if (scene.currentZone === "Outer Grasslands") {
      extraOption = "Return to Village";
    } else if (scene.currentZone !== "Village") {
      let currentIndex = zoneList.findIndex(z => z.name === scene.currentZone);
      if (currentIndex > 0) {
        extraOption = `Return to ${zoneList[currentIndex - 1].name}`;
      }
    }
    if (extraOption) {
      lines.push({
        label: extraOption,
        highlight: true,  // Make it stand out
        callback: () => {
          handleReturn(scene);
        }
      });
    }
  }
  
  lines.push({
    label: "Back",
    callback: () => {
      scene.narrativeScreen = SCREEN_PROMPT;
      clearButtons(scene);
      showPrompt(scene);
    }
  });
  
  createButtons(scene, lines);
}

async function showOutcome(scene) {
  clearButtons(scene);
  if (!scene.activePrompt) return;
  if (scene.chosenOptionIndex < 0 || scene.chosenOptionIndex >= scene.activePrompt.outcomes.length) return;
  const outcomeText = scene.activePrompt.outcomes[scene.chosenOptionIndex];
  
  // Show loading animation
  showDialog(scene, "Processing outcome, please wait...");
  
  // Add short delay for anticipation
  await new Promise(resolve => {
    scene.time.delayedCall(300, resolve);
  });
  
  // Apply the outcome with visual effects
  scene.cameras.main.flash(200, 255, 255, 255, true);
  await applyOutcome(scene, outcomeText);
  scene.narrativeScreen = SCREEN_OUTCOME;
}

function showItemMenu(scene) {
  showDialog(scene, "Item Options:\nPress 'U' to Use Item\nPress 'E' to Equip Item\n\n(Press SPACE to continue playing)");
  const uKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
  const eKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  const spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  uKey.once("down", () => {
    spaceKey.removeAllListeners();
    eKey.removeAllListeners();
    scene.narrativeScreen = SCREEN_ITEM_PICK;
    showItemPick(scene, true);
  });
  
  eKey.once("down", () => {
    spaceKey.removeAllListeners();
    uKey.removeAllListeners();
    scene.narrativeScreen = SCREEN_ITEM_PICK;
    showItemPick(scene, false);
  });
  
  spaceKey.once("down", () => {
    uKey.removeAllListeners();
    eKey.removeAllListeners();
    hideDialog(scene);
    endFlow(scene);
  });
}

function showItemPick(scene, isUseFlow) {
  hideDialog(scene);
  const inv = scene.localInventory || [];
  if (inv.length === 0) {
    showDialog(scene, "Your inventory is empty.\n(Press SPACE to end)");
    return;
  }
  
  const lines = inv.map(item => {
    const itemData = getItemData(scene, item.name);
    const description = itemData && itemData.description ? ` - ${itemData.description.slice(0, 20)}...` : '';
    
    return {
      label: `${item.name} x${item.quantity}${description}`,
      callback: () => {
        clearButtons(scene);
        if (isUseFlow) handleUseItem(scene, item);
        else handleEquipItem(scene, item.name);
      }
    };
  });
  
  lines.push({
    label: "Cancel",
    callback: () => {
      clearButtons(scene);
      endFlow(scene);
    }
  });
  
  createButtons(scene, lines);
  showDialog(scene, `Select an item to ${isUseFlow ? "use" : "equip"}`);
}

function handleUseItem(scene, item) {
  const itemData = getItemData(scene, item.name);
  if (applyItemEffects(scene, itemData)) {
    removeFromInventory(scene, item.name, 1);
    
    // Simple effect instead of particle effect
    if (scene.player) {
      createSimpleEffect(scene, scene.player.x, scene.player.y, EFFECT_COLORS.HEAL);
    }
    
    alert(`Used ${item.name}.`);
  } else {
    alert(`${item.name} has no usable effects.`);
  }
  endFlow(scene);
}

function handleEquipItem(scene, itemName) {
  scene.equippedItems.push(itemName);
  recalcEquippedResist(scene);
  
  // Visual feedback with simple effect instead of particles
  if (scene.player) {
    createSimpleEffect(scene, scene.player.x, scene.player.y, 0x00ffff);
    
    scene.player.setTint(0x00ffff);
    scene.time.delayedCall(300, () => scene.player.clearTint());
  }
  
  alert(`Equipped ${itemName}.`);
  endFlow(scene);
}

function handleReturn(scene) {
  let targetZone = null;
  if (scene.currentZone === "Outer Grasslands") {
    targetZone = zoneList.find(z => z.name.toLowerCase() === "village");
  } else if (scene.currentZone !== "Village") {
    let currentIndex = zoneList.findIndex(z => z.name === scene.currentZone);
    if (currentIndex > 0) targetZone = zoneList[currentIndex - 1];
  }
  if (targetZone) {
    console.log(`Return option selected. Traveling to zone: ${targetZone.name}`);
    showDialog(scene, `Returning to ${targetZone.name}...\n(Press SPACE to continue)`);
    
    // Transition effect
    scene.cameras.main.fadeOut(500);
    
    scene.input.keyboard.once("keydown-SPACE", () => {
      const currentOromozi = scene.playerStats.oromozi;
      scene.playerStats = createInitialStats(targetZone.name, currentOromozi);
      
      // Preserve level and experience
      if (scene.playerStats.level) {
        scene.playerStats.level = scene.playerStats.level;
        scene.playerStats.experience = scene.playerStats.experience;
      }
      
      scene.scene.restart({ zone: targetZone, inventory: scene.localInventory, promptCount: 0 });
    });
  } else {
    console.warn("Return option selected, but no target zone found.");
  }
}

/* =======================================================
   10) PHASER GAME CONFIG & SCENE FUNCTIONS (IMPROVED)
======================================================= */
class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "hickory_idle");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setDepth(2000);

    this.currentState = "idle";
    this.anims.play("monster_idle", true);

    // Scale monster stats with player level
    const playerLevel = scene.playerStats.level || 1;
    const difficultyMultiplier = 1 + (playerLevel - 1) * 0.2;
    
    this.speed = 50 + (playerLevel - 1) * 5;
    this.attackRange = 40; // Increased for better hit detection
    this.detectionRange = 200 + (playerLevel - 1) * 10;
    this.attackCooldown = Math.max(800, 1000 - (playerLevel - 1) * 50); // Faster attacks at higher levels
    this.lastAttackTime = 0;
    this.maxHealth = Math.floor(80 * difficultyMultiplier);
    this.health = this.maxHealth;
    this.damage = 5 + Math.floor((playerLevel - 1) * 1.2);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(2001); // Above monster
    this.updateHealthBar();
    
    // Add monster name/level display
    this.levelText = scene.add.text(this.x, this.y - 30, `Monster Lv.${playerLevel}`, {
      font: '10px Arial',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(2001);
    
          // Simple red tint for night predators
    if (scene.isNight) {
      this.setTint(0xff5555);
    }
  }

  updateHealthBar() {
    this.healthBar.clear();
    const barWidth = 30; // Width of the health bar
    const barHeight = 5; // Height of the health bar
    const healthRatio = this.health / this.maxHealth;
    
    // Background (red)
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(this.x - barWidth / 2, this.y - 20, barWidth, barHeight);
    
    // Fill (green portion)
    this.healthBar.fillStyle(0x00ff00); // Green
    this.healthBar.fillRect(this.x - barWidth / 2, this.y - 20, barWidth * healthRatio, barHeight);
    
    // Outline
    this.healthBar.lineStyle(1, 0xffffff); // White border
    this.healthBar.strokeRect(this.x - barWidth / 2, this.y - 20, barWidth, barHeight);
    
    // Update level text position
    if (this.levelText) {
      this.levelText.setPosition(this.x, this.y - 30);
    }
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.updateHealthBar(); // Update health bar position and size
    
    const player = this.scene.player;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance <= this.attackRange) {
      if (this.currentState !== "attacking") {
        this.currentState = "attacking";
        this.anims.play("monster_attack", true);
      }
      this.setVelocity(0);
      if (time > this.lastAttackTime + this.attackCooldown) {
        this.attack(player);
        this.lastAttackTime = time;
      }
    } else if (distance <= this.detectionRange) {
      if (this.currentState !== "walking") {
        this.currentState = "walking";
        this.anims.play("monster_walk", true);
      }
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    } else {
      if (this.currentState !== "idle") {
        this.currentState = "idle";
        this.anims.play("monster_idle", true);
      }
      this.setVelocity(0);
    }

    this.flipX = player.x < this.x;
  }

  attack(player) {
    if (this.scene.playerStats.health > 0) {
      // Calculate damage with some player defense reduction
      const battleStats = this.calculateBattleStats(this.scene);
      const damage = Math.max(1, this.damage - Math.floor(battleStats.defense * 0.3));
      
      
      this.scene.playerStats.health = Math.max(this.scene.playerStats.health - damage, 0);
      console.log("Monster attacked player! Health:", this.scene.playerStats.health);
      
      // Visual feedback
      player.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => player.clearTint());
      this.scene.cameras.main.shake(100, 0.005 * damage);
      
      // Floating damage text
      createFloatingText(this.scene, player.x, player.y - 20, `-${damage}`, 0xff0000);
      
      updateHUD(this.scene);
    }
  }

  takeDamage(damage) {
    this.health -= damage;
    console.log(`Monster took ${damage} damage, health now: ${this.health}`);
    
    // Show damage number
    createFloatingText(this.scene, this.x, this.y - 20, `-${damage}`, 0xff0000);
    
    if (this.health <= 0) {
      // Death effect
      createSimpleEffect(this.scene, this.x, this.y, 0xff0000);
      
      // Award experience
      const expGain = 10 + Math.floor(Math.random() * 5);
      this.scene.playerStats.experience = (this.scene.playerStats.experience || 0) + expGain;
      createFloatingText(this.scene, this.x, this.y - 40, `+${expGain} EXP`, 0x00ffff);
      
      // Chance for loot
      if (Math.random() < 0.4) {
        const loot = getRandomLootForZone(this.scene);
        if (loot) {
          addToInventory(this.scene, loot);
          createFloatingText(this.scene, this.x, this.y - 60, `+${loot}`, 0xffff00);
        }
      }
      
      // Check for level up
      checkLevelUp(this.scene);
      
      this.healthBar.destroy();
      if (this.levelText) this.levelText.destroy();
      this.destroy();
      console.log("Monster defeated!");
    } else {
      this.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => {
        this.clearTint();
      }, [], this);
      this.updateHealthBar(); // Immediate update for feedback
    }
  }

  destroy() {
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    if (this.levelText) {
      this.levelText.destroy();
    }
    super.destroy();
  }

  // Function to calculate battle statistics based on player state and equipment
  calculateBattleStats(scene) {
    if (!scene || !scene.playerStats) {
      // Return default values if scene or playerStats not available
      return { attack: 10, defense: 5 };
    }
    
    // Base stats that scale with level
    const baseAttack = 10 + (scene.playerStats.level - 1) * 2;
    const baseDefense = 5 + (scene.playerStats.level - 1);
    
    // Add any equipped item bonuses (if available)
    const attackBonus = scene.playerStats.attackBonus || 0;
    const defenseBonus = scene.playerStats.defenseBonus || 0;
    
    return {
      attack: baseAttack + attackBonus,
      defense: baseDefense + defenseBonus
    };
  }
}

function preload() {
  this.load.json("OuterGrasslandsMap", "assets/maps/outerGrasslands.json");
  this.load.json("ShadyGroveMap", "assets/maps/shadyGrove.json");
  this.load.json("AridDesertMap", "assets/maps/aridDesert.json");
  this.load.json("villageCommonsMap", "assets/maps/villageCommonsMap.json");
  this.load.json("fishing_map", "assets/maps/fishing_lake.json");

  this.load.image("outerGrasslands", "assets/backgrounds/outerGrasslands.png");
  this.load.image("shadyGrove", "assets/backgrounds/shadyGrove.png");
  this.load.image("aridDesert", "assets/backgrounds/aridDesert.png");
  this.load.image("villageCommons", "assets/backgrounds/villageCommons.png");
  this.load.image("outerGrasslandsForeground", "assets/foregrounds/outerGrasslandsForeground.png");
  this.load.image("shadyGroveForeground", "assets/foregrounds/shadyGroveForeground.png");
  this.load.image("aridDesertForeground", "assets/foregrounds/aridDesertForeground.png");

  // Fishing scene assets
  this.load.image("lake", "assets/images/lake.png");
  this.load.image("lake_foreground", "assets/images/lake_foreground.png");
  this.load.image("fishing_pole", "assets/images/fishing_pole.png");
  this.load.image("bobber", "assets/images/bobber.png");
  this.load.image("menu_icon", "assets/images/menu.png");
  this.load.spritesheet("boat_idle", "assets/images/boat_idle.png", { frameWidth: 163, frameHeight: 224, margin: 0, spacing: 0 });
  this.load.spritesheet("boat_moving", "assets/images/boat_moving.png", { frameWidth: 163, frameHeight: 224, margin: 0, spacing: 0 });

  this.load.spritesheet("player", "assets/sprites/player.png", {
    frameWidth: 48,
    frameHeight: 48,
    margin: 0,
    spacing: 0
  });

  this.load.spritesheet("loot_crate", "assets/sprites/crate.png", {
    frameWidth: 64,
    frameHeight: 64
  });

  this.load.image("exclamation", "assets/sprites/exclamation.png");
  
  // Not using particle image since we switched to simple effects

  this.load.spritesheet("hickory_idle", "assets/sprites/Hickory_Idle.png", { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 });
  this.load.spritesheet("hickory_walk", "assets/sprites/Hickory_Walk.png", { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 });
  this.load.spritesheet("hickory_attack", "assets/sprites/Hickory_Attack.png", { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 });

  this.load.json("narrativePrologues", "assets/data/narrativePrologues.json");
  this.load.json("narrativePrompts", "assets/data/narrativeprompt.json");
  this.load.json("lootTable", "assets/data/lootTable.json");
  
  // No sound preloads for now
}

function createScene() {
  console.log("createScene: Received scene data:", this.scene.settings.data);
  
  // Initialize inventory with default camping materials only if there's no passed inventory
  if (!this.scene.settings.data || !this.scene.settings.data.inventory) {
    this.localInventory = [
      { name: "Cloth", quantity: 1 },
      { name: "Stick", quantity: 2 }
    ];
    console.log("No inventory data found, using default camping materials");
  } else {
    // Use the inventory passed from the previous scene
    this.localInventory = this.scene.settings.data.inventory;
    console.log("Using passed inventory data:", this.localInventory);
  }
  
  let defaultZone = zoneList.find(z => z.name === "Village");
  if (!this.scene.settings.data || !this.scene.settings.data.zone) {
    this.scene.settings.data = {
      zone: defaultZone,
      inventory: this.localInventory,
      promptCount: 0
    };
    console.log("Defaulting zone to Village with camping materials.");
  }

  // For testing purposes, add a dungeon key to inventory if in village and no dungeon key exists
  if (this.scene.settings.data.zone.name === "Village" && 
      !this.localInventory.some(item => item.name === "Dungeon Key")) {
    this.localInventory.push({ name: "Dungeon Key", quantity: 1 });
  }

  // Initialize narrative screen
  this.narrativeScreen = SCREEN_NONE;

  const existingOromozi = this.playerStats ? this.playerStats.oromozi : 1000;
  const existingLevel = this.playerStats ? this.playerStats.level : 1;
  const existingExp = this.playerStats ? this.playerStats.experience : 0;
  
  if (!this.playerStats) {
    this.playerStats = createInitialStats(this.scene.settings.data.zone.name, existingOromozi);
  } else {
    this.playerStats.currentZone = this.scene.settings.data.zone.name;
  }
  
  // Preserve progression between zone changes
  if (existingLevel > 1) {
    this.playerStats.level = existingLevel;
    this.playerStats.experience = existingExp;
  }
  
  this.promptCount = this.scene.settings.data.promptCount || 0;
  this.deposits = this.deposits || [];
  this.listedItems = this.listedItems || [];
  initEquippedData(this);

  // Initialize flags
  this.isRestarting = false;
  this.isDying = false;

  if (!this.registry.get('gameTime')) {
    this.registry.set('gameTime', 0);
  }
  this.secondsPerDay = 240;
  this.secondsPerHour = this.secondsPerDay / 24;

  if (this.scene.settings.data.zone.name !== "Village" && !this.initialScavengerInventory) {
    this.initialScavengerInventory = JSON.parse(JSON.stringify(this.localInventory));
    this.lastInventoryState = JSON.parse(JSON.stringify(this.localInventory));
    console.log("Initial Scavenger Mode inventory set:", this.initialScavengerInventory);
  }

  let zoneData;
  if (this.scene.settings.data.zone) {
    zoneData = this.scene.settings.data.zone;
    for (let i = 0; i < zoneList.length; i++) {
      if (zoneList[i].name === zoneData.name) {
        currentZoneIndex = i;
        break;
      }
    }
    console.log("createScene: New zone data found:", zoneData.name);
  } else {
    zoneData = zoneList[currentZoneIndex];
    console.log("createScene: No new zone data; using current zone:", zoneData.name);
  }
  this.currentZone = zoneData.name;
  this.playerStats.currentZone = this.currentZone;
  this.hasPromptedCamping = false;
  this.lastCampingPromptTime = null;
  
  // Initialize arrays for tracking game objects
  this.exclamationSprites = [];
  this.miniMapMonsters = [];
  this.miniMapCrates = [];

  const mapData = this.cache.json.get(zoneData.mapKey);
  let bgX = 0;
  let bgY = 0;
  if (mapData && mapData.layers) {
    const backgroundLayer = mapData.layers.find(layer => layer.type === "imagelayer" && layer.name.toLowerCase() === "background");
    if (backgroundLayer) {
      bgX = backgroundLayer.x || 0;
      bgY = backgroundLayer.y || 0;
    }
  }
  this.background = this.add.image(bgX * bgScale, bgY * bgScale, zoneData.backgroundKey).setOrigin(0, 0).setScale(bgScale);
  this.physics.world.setBounds(0, 0, this.background.displayWidth, this.background.displayHeight);
  this.cameras.main.setBounds(0, 0, this.background.displayWidth, this.background.displayHeight);

  // No particle system needed with simplified effects

  this.obstacles = this.physics.add.staticGroup();

  if (zoneData.name === "Village") {
    // Village-specific setup
    this.interactionObjects = this.physics.add.staticGroup();
    
    if (mapData && mapData.layers) {
      mapData.layers.forEach(layer => {
        if (layer.type === "objectgroup" && layer.name === "Object Layer 1") {
          const offsetX = layer.offsetx || 0;
          const offsetY = layer.offsety || 0;
          layer.objects.forEach(obj => {
            // Add a slightly smaller collision box for better movement
            const rect = this.add.rectangle(
              (obj.x + offsetX) * bgScale + 5,
              (obj.y + offsetY) * bgScale + 5,
              obj.width * bgScale - 10,
              obj.height * bgScale - 10,
              0xff0000,
              0
            );
            rect.setOrigin(0, 0);
            this.physics.add.existing(rect, true);
            this.obstacles.add(rect);
          });
        } else if (layer.type === "objectgroup" && layer.name.toLowerCase() === "interactions") {
          layer.objects.forEach(obj => {
            const interactiveObj = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x00ff00,
              0
            );
            interactiveObj.setOrigin(0, 0);
            this.physics.add.existing(interactiveObj, true);
            interactiveObj.body.enable = false;
            interactiveObj.setInteractive();
            
            // Add visual hint for interactive objects
            const hintGlow = this.add.graphics();
            hintGlow.lineStyle(2, 0x00ffff, 0.5);
            hintGlow.strokeRect(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale
            );
            hintGlow.setDepth(900);
            
            // Pulse animation for interaction hint
            this.tweens.add({
              targets: hintGlow,
              alpha: { from: 0.3, to: 0.8 },
              duration: 1000,
              yoyo: true,
              repeat: -1
            });
            
            interactiveObj.on("pointerdown", () => {
              console.log("Clicked on village object:", obj);
              handleVillageContractInteraction(this, obj);
            });
            
            interactiveObj.on("pointerover", () => {
              // Show interaction label
              const label = this.add.text(
                obj.x * bgScale + (obj.width * bgScale / 2),
                obj.y * bgScale - 10,
                obj.name.replace(/_/g, " "),
                {
                  font: "14px Arial",
                  fill: "#ffffff",
                  stroke: "#000000",
                  strokeThickness: 3
                }
              ).setOrigin(0.5, 1).setDepth(1000);
              
              interactiveObj.label = label;
            });
            
            interactiveObj.on("pointerout", () => {
              if (interactiveObj.label) {
                interactiveObj.label.destroy();
                interactiveObj.label = null;
              }
            });
            
            this.interactionObjects.add(interactiveObj);
          });
        }
      });
    }

      
        
    
  } else {
    // Non-village zone setup
    if (mapData && mapData.layers) {
      mapData.layers.forEach(layer => {
        if (layer.type === "objectgroup" && layer.name === "Object Layer 1") {
          const offsetX = layer.offsetx || 0;
          const offsetY = layer.offsety || 0;
          layer.objects.forEach(obj => {
            // Use slightly smaller collision boxes for better movement
            const rect = this.add.rectangle(
              (obj.x + offsetX) * bgScale + 5,
              (obj.y + offsetY) * bgScale + 5,
              obj.width * bgScale - 10,
              obj.height * bgScale - 10,
              0xff0000,
              0
            );
            rect.setOrigin(0, 0);
            this.physics.add.existing(rect, true);
            this.obstacles.add(rect);
          });
        } else if (layer.type === "objectgroup" && layer.name === "fishing spots") {
          layer.objects.forEach(obj => {
            // Create fishing spot hitbox
            const spot = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x0000ff,
              0.2
            );
            spot.setOrigin(0, 0);
            spot.setInteractive();
            
            // Add visual indicator
            const indicator = this.add.sprite(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2),
              'loot_crate'
            ).setScale(bgScale);
            indicator.setTint(0x0000ff);
            
            // Add hover effect
            spot.on('pointerover', () => {
              indicator.setTint(0x00ffff);
              const label = this.add.text(
                spot.x + spot.width / 2,
                spot.y - 10,
                'Fishing Spot',
                {
                  font: '14px Arial',
                  fill: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 3
                }
              ).setOrigin(0.5, 1).setDepth(1000);
              spot.label = label;
            });
            
            spot.on('pointerout', () => {
              indicator.setTint(0x0000ff);
              if (spot.label) {
                spot.label.destroy();
                spot.label = null;
              }
            });
            
            // Handle fishing spot click
            spot.on('pointerdown', () => {
              // Check if player has already fished today
              const gameTime = this.registry.get('gameTime') || 0;
              const lastFishingDay = this.registry.get('lastFishingDay') || -1;
              const currentDay = Math.floor(gameTime / (24 * 60 * 60)); // Convert seconds to days
              
              if (currentDay <= lastFishingDay) {
                showDialog(this, "You've already gone fishing today.\nTry again tomorrow!\n(Press SPACE to continue)");
                return;
              }
              
              // Set last fishing day
              this.registry.set('lastFishingDay', currentDay);
              
              // Transition to fishing scene
              this.cameras.main.fadeOut(500);
              this.time.delayedCall(500, () => {
                this.scene.start('FishingScene', {
                  returnScene: 'MainGameScene',
                  returnZone: zoneList.find(z => z.name === this.currentZone),
                  inventory: this.localInventory,
                  playerStats: this.playerStats
                });
              });
            });
          });
        } else if (layer.type === "objectgroup" && layer.name === "VillageCommons") {
          // Process VillageCommons object layer for travel back to village
          layer.objects.forEach(obj => {
            // Create travel point hitbox
            const spot = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x00ff00,
              0.1
            );
            spot.setOrigin(0, 0);
            spot.setInteractive();
            
            // Add visual indicator
            const indicator = this.add.circle(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2),
              15,
              0x00aa00,
              0.8
            );
            indicator.setStrokeStyle(2, 0x00ff00);
            indicator.setDepth(900);
            
            // Add pulse effect
            this.tweens.add({
              targets: indicator,
              alpha: { from: 0.6, to: 1 },
              duration: 1500,
              yoyo: true,
              repeat: -1
            });
            
            // Add label
            const label = this.add.text(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2) - 25,
              "Village Commons",
              {
                font: "14px Arial",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3
              }
            ).setOrigin(0.5).setDepth(900);
            
            // Add hover effect
            spot.on('pointerover', () => {
              indicator.setFillStyle(0x00ff00);
            });
            
            spot.on('pointerout', () => {
              indicator.setFillStyle(0x00aa00);
            });
            
            // Handle click
            spot.on('pointerdown', () => {
              const targetZone = zoneList.find(z => z.name.toLowerCase() === "village");
              if (targetZone) {
                showDialog(this, "Return to Village Commons?\n(Press SPACE to confirm)");
                this.input.keyboard.once("keydown-SPACE", () => {
                  // Add transition effect
                  this.cameras.main.fadeOut(500);
                  this.time.delayedCall(500, () => {
                    const currentOromozi = this.playerStats.oromozi;
                    const currentLevel = this.playerStats.level;
                    const currentExp = this.playerStats.experience;
                    this.playerStats = createInitialStats(targetZone.name, currentOromozi);
                    
                    // Preserve level and experience
                    if (currentLevel) {
                      this.playerStats.level = currentLevel;
                      this.playerStats.experience = currentExp;
                    }
                    
                    this.scene.restart({ 
                      zone: targetZone, 
                      inventory: this.localInventory, 
                      promptCount: 0 
                    });
                  });
                });
              }
            });
          });
        } else if (layer.type === "objectgroup" && layer.name === "ShadyGrove") {
          // Process ShadyGrove object layer for travel to Shady Grove if player has the map
          layer.objects.forEach(obj => {
            // Create travel point hitbox
            const spot = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x008800,
              0.1
            );
            spot.setOrigin(0, 0);
            spot.setInteractive();
            
            // Add visual indicator
            const indicator = this.add.circle(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2),
              15,
              0x005500,
              0.8
            );
            indicator.setStrokeStyle(2, 0x00aa00);
            indicator.setDepth(900);
            
            // Add pulse effect
            this.tweens.add({
              targets: indicator,
              alpha: { from: 0.6, to: 1 },
              duration: 1500,
              yoyo: true,
              repeat: -1
            });
            
            // Add label
            const label = this.add.text(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2) - 25,
              "Shady Grove",
              {
                font: "14px Arial",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3
              }
            ).setOrigin(0.5).setDepth(900);
            
            // Add hover effect
            spot.on('pointerover', () => {
              indicator.setFillStyle(0x00aa00);
            });
            
            spot.on('pointerout', () => {
              indicator.setFillStyle(0x005500);
            });
            
            // Handle click
            spot.on('pointerdown', () => {
              // Check if player has Shady Grove Map
              const hasMap = this.localInventory.some(item => 
                item.name.toLowerCase() === "shady grove map" && item.quantity > 0
              );
              
              if (hasMap) {
                const targetZone = zoneList.find(z => z.name === "Shady Grove");
                if (targetZone) {
                  showDialog(this, "Travel to Shady Grove?\n(Press SPACE to confirm)");
                  this.input.keyboard.once("keydown-SPACE", () => {
                    // Add transition effect
                    this.cameras.main.fadeOut(500);
                    this.time.delayedCall(500, () => {
                      const currentOromozi = this.playerStats.oromozi;
                      const currentLevel = this.playerStats.level;
                      const currentExp = this.playerStats.experience;
                      this.playerStats = createInitialStats(targetZone.name, currentOromozi);
                      
                      // Preserve level and experience
                      if (currentLevel) {
                        this.playerStats.level = currentLevel;
                        this.playerStats.experience = currentExp;
                      }
                      
                      this.scene.restart({ 
                        zone: targetZone, 
                        inventory: this.localInventory, 
                        promptCount: 0 
                      });
                    });
                  });
                }
              } else {
                showDialog(this, "You need a Shady Grove Map to travel here.\n(Press SPACE to continue)");
                this.input.keyboard.once("keydown-SPACE", () => {
                  hideDialog(this);
                });
              }
            });
          });
        } else if (layer.type === "objectgroup" && layer.name === "OuterGrasslands") {
          // Process OuterGrasslands object layer for travel back to Outer Grasslands
          layer.objects.forEach(obj => {
            // Create travel point hitbox
            const spot = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x008800,
              0.1
            );
            spot.setOrigin(0, 0);
            spot.setInteractive();
            
            // Add visual indicator
            const indicator = this.add.circle(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2),
              15,
              0x228800,
              0.8
            );
            indicator.setStrokeStyle(2, 0x22cc00);
            indicator.setDepth(900);
            
            // Add pulse effect
            this.tweens.add({
              targets: indicator,
              alpha: { from: 0.6, to: 1 },
              duration: 1500,
              yoyo: true,
              repeat: -1
            });
            
            // Add label
            const label = this.add.text(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2) - 25,
              "Outer Grasslands",
              {
                font: "14px Arial",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3
              }
            ).setOrigin(0.5).setDepth(900);
            
            // Add hover effect
            spot.on('pointerover', () => {
              indicator.setFillStyle(0x22cc00);
            });
            
            spot.on('pointerout', () => {
              indicator.setFillStyle(0x228800);
            });
            
            // Handle click
            spot.on('pointerdown', () => {
              const targetZone = zoneList.find(z => z.name === "Outer Grasslands");
              if (targetZone) {
                showDialog(this, "Travel to Outer Grasslands?\n(Press SPACE to confirm)");
                this.input.keyboard.once("keydown-SPACE", () => {
                  // Add transition effect
                  this.cameras.main.fadeOut(500);
                  this.time.delayedCall(500, () => {
                    const currentOromozi = this.playerStats.oromozi;
                    const currentLevel = this.playerStats.level;
                    const currentExp = this.playerStats.experience;
                    this.playerStats = createInitialStats(targetZone.name, currentOromozi);
                    
                    // Preserve level and experience
                    if (currentLevel) {
                      this.playerStats.level = currentLevel;
                      this.playerStats.experience = currentExp;
                    }
                    
                    this.scene.restart({ 
                      zone: targetZone, 
                      inventory: this.localInventory, 
                      promptCount: 0 
                    });
                  });
                });
              }
            });
          });
        } else if (layer.type === "objectgroup" && layer.name === "AridDesert") {
          // Process AridDesert object layer for travel to Arid Desert if player has the map
          layer.objects.forEach(obj => {
            // Create travel point hitbox
            const spot = this.add.rectangle(
              obj.x * bgScale,
              obj.y * bgScale,
              obj.width * bgScale,
              obj.height * bgScale,
              0x884400,
              0.1
            );
            spot.setOrigin(0, 0);
            spot.setInteractive();
            
            // Add visual indicator
            const indicator = this.add.circle(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2),
              15,
              0xcc6600,
              0.8
            );
            indicator.setStrokeStyle(2, 0xff8800);
            indicator.setDepth(900);
            
            // Add pulse effect
            this.tweens.add({
              targets: indicator,
              alpha: { from: 0.6, to: 1 },
              duration: 1500,
              yoyo: true,
              repeat: -1
            });
            
            // Add label
            const label = this.add.text(
              obj.x * bgScale + (obj.width * bgScale / 2),
              obj.y * bgScale + (obj.height * bgScale / 2) - 25,
              "Arid Desert",
              {
                font: "14px Arial",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3
              }
            ).setOrigin(0.5).setDepth(900);
            
            // Add hover effect
            spot.on('pointerover', () => {
              indicator.setFillStyle(0xff8800);
            });
            
            spot.on('pointerout', () => {
              indicator.setFillStyle(0xcc6600);
            });
            
            // Handle click
            spot.on('pointerdown', () => {
              // Check if player has Arid Desert Map
              const hasMap = this.localInventory.some(item => 
                item.name.toLowerCase() === "arid desert map" && item.quantity > 0
              );
              
              if (hasMap) {
                const targetZone = zoneList.find(z => z.name === "Arid Desert");
                if (targetZone) {
                  showDialog(this, "Travel to Arid Desert?\n(Press SPACE to confirm)");
                  this.input.keyboard.once("keydown-SPACE", () => {
                    // Add transition effect
                    this.cameras.main.fadeOut(500);
                    this.time.delayedCall(500, () => {
                      const currentOromozi = this.playerStats.oromozi;
                      const currentLevel = this.playerStats.level;
                      const currentExp = this.playerStats.experience;
                      this.playerStats = createInitialStats(targetZone.name, currentOromozi);
                      
                      // Preserve level and experience
                      if (currentLevel) {
                        this.playerStats.level = currentLevel;
                        this.playerStats.experience = currentExp;
                      }
                      
                      this.scene.restart({ 
                        zone: targetZone, 
                        inventory: this.localInventory, 
                        promptCount: 0 
                      });
                    });
                  });
                }
              } else {
                showDialog(this, "You need an Arid Desert Map to travel here.\n(Press SPACE to continue)");
                this.input.keyboard.once("keydown-SPACE", () => {
                  hideDialog(this);
                });
              }
            });
          });
        } else if (
          layer.type === "imagelayer" &&
          layer.name.toLowerCase() === zoneData.foregroundKey.toLowerCase()
        ) {
          const offX = layer.x || 0;
          const offY = layer.y || 0;
          this.foreground = this.add.image(offX * bgScale, offY * bgScale, zoneData.foregroundKey)
            .setOrigin(0, 0)
            .setScale(bgScale);
          this.foreground.setDepth(1000);
        }
      });
    }
    
    // If in Outer Grasslands, add a dungeon entrance
    if (zoneData.name === "Outer Grasslands") {
      // Create dungeon entrance at the correct position from map file (scaled to match game)
      const dungeonX = 2066.37 * bgScale;
      const dungeonY = 1893.89 * bgScale;
      
      // Create a visible marker for the dungeon entrance
      const dungeonMarker = this.add.circle(dungeonX, dungeonY, 15, 0x440044, 0.8);
      dungeonMarker.setStrokeStyle(2, 0xaa00aa, 1);
      dungeonMarker.setDepth(900);
      
      // Add glow effect
      this.tweens.add({
        targets: dungeonMarker,
        alpha: { from: 0.6, to: 1 },
        duration: 1500,
        yoyo: true,
        repeat: -1
      });
      
      // Add label
      const dungeonLabel = this.add.text(dungeonX, dungeonY - 25, "Ancient Dungeon", {
        font: "14px Arial",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(900);
      
      // Make it interactive
      dungeonMarker.setInteractive({ useHandCursor: true });
      dungeonMarker.name = "dungeon_entrance";
      dungeonMarker.on("pointerdown", () => {
        handleVillageContractInteraction(this, dungeonMarker);
      });
      
      // Store reference to dungeon marker directly instead of using a group
      this.dungeonMarker = dungeonMarker;
      
      // Create a container to hold the dungeon marker elements for proper depth management
      const dungeonContainer = this.add.container(0, 0);
      dungeonContainer.add([dungeonMarker, dungeonLabel]);
      dungeonContainer.setDepth(900);
    }
  }

  // Improved night overlay with stars
  this.nightOverlay = this.add.rectangle(
    this.cameras.main.width / 2,
    this.cameras.main.height / 2,
    this.cameras.main.width,
    this.cameras.main.height,
    0x000033,
    0.6
  )
    .setOrigin(0.5)
    .setDepth(1500)
    .setScrollFactor(0);

  // Add stars to night sky (only visible at night)
  this.stars = [];
  for (let i = 0; i < 50; i++) {
    const star = this.add.circle(
      Phaser.Math.Between(0, this.cameras.main.width),
      Phaser.Math.Between(0, this.cameras.main.height / 2),
      Phaser.Math.Between(1, 2),
      0xffffff,
      1
    ).setScrollFactor(0).setDepth(1501).setAlpha(0);
    
    // Twinkle animation
    this.tweens.add({
      targets: star,
      alpha: { from: 0.3, to: 0.9 },
      duration: Phaser.Math.Between(1000, 3000),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 2000)
    });
    
    this.stars.push(star);
  }

  const gameTime = this.registry.get('gameTime');
  const gameHour = (6 + Math.floor(gameTime / this.secondsPerHour)) % 24;
  const isNight = gameHour >= 20 || gameHour < 6;
  this.nightOverlay.setAlpha(isNight ? 0.8 : 0);
  this.stars.forEach(star => star.setAlpha(isNight ? Phaser.Math.Between(3, 9) * 0.1 : 0));
  this.wasNight = isNight;
  this.isNight = isNight;

  // Create player with improved visuals
  this.player = this.physics.add.sprite(100 * bgScale, 100 * bgScale, "player");
  this.player.setScale(playerScale * 0.5);
  this.player.setCollideWorldBounds(true);
  this.player.setDepth(2000);
  
  // Add subtle shadow beneath player
  this.playerShadow = this.add.ellipse(
    this.player.x,
    this.player.y + 12,
    20,
    10,
    0x000000,
    0.3
  ).setDepth(1999);

  // Create visual health bar that follows player
  this.healthBar = this.add.graphics().setDepth(3000).setScrollFactor(0);
  
  // Improved collision box for player (smaller than sprite for better movement)
  this.player.body.setSize(16, 16);
  this.player.body.setOffset(16, 20);

  // Create player animations (unchanged)
  this.anims.create({
    key: "walk-down",
    frames: this.anims.generateFrameNumbers("player", { start: 18, end: 23 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "walk-right",
    frames: this.anims.generateFrameNumbers("player", { start: 6, end: 11 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "walk-up",
    frames: this.anims.generateFrameNumbers("player", { start: 30, end: 35 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "walk-left",
    frames: this.anims.generateFrameNumbers("player", { start: 24, end: 29 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "idle-down",
    frames: this.anims.generateFrameNumbers("player", { start: 0, end: 5 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "idle-up",
    frames: this.anims.generateFrameNumbers("player", { start: 12, end: 17 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "idle-left",
    frames: [{ key: "player", frame: 24 }],
    frameRate: 10
  });

  this.anims.create({
    key: "idle-right",
    frames: [{ key: "player", frame: 6 }],
    frameRate: 10
  });

  this.anims.create({
    key: "attack-down",
    frames: this.anims.generateFrameNumbers("player", { start: 36, end: 39 }),
    frameRate: 15,
    repeat: 0
  });

  this.anims.create({
    key: "attack-right",
    frames: this.anims.generateFrameNumbers("player", { start: 42, end: 45 }),
    frameRate: 15,
    repeat: 0
  });

  this.anims.create({
    key: "attack-up",
    frames: this.anims.generateFrameNumbers("player", { start: 48, end: 51 }),
    frameRate: 15,
    repeat: 0
  });

  this.anims.create({
    key: "attack-left",
    frames: this.anims.generateFrameNumbers("player", { start: 54, end: 57 }),
    frameRate: 15,
    repeat: 0
  });

  this.player.anims.play("idle-down", true);
  this.lastDirection = "down";

  this.isAttacking = false;

  this.player.on('animationcomplete', (animation) => {
    if (animation.key.startsWith('attack-')) {
      this.isAttacking = false;
    }
  });

  // Improved attack logic with visual effects
  this.applyAttackDamage = () => {
    const attackRange = 120; // Increased range for better detection
    const verticalTolerance = 50; // Increased tolerance
    let monstersInRange = [];
    console.log("Player at:", this.player.x, this.player.y, "Direction:", this.lastDirection);
    
    // Create attack effect based on direction
    let effectX = this.player.x;
    let effectY = this.player.y;
    
    if (this.lastDirection === "right") {
      effectX = this.player.x + 30;
      monstersInRange = this.monsters.getChildren().filter(monster => {
        const inRange = monster.x > this.player.x && monster.x < this.player.x + attackRange &&
                        Math.abs(monster.y - this.player.y) < verticalTolerance;
        if (inRange) console.log("Monster in range at:", monster.x, monster.y);
        return inRange;
      });
    } else if (this.lastDirection === "left") {
      effectX = this.player.x - 30;
      monstersInRange = this.monsters.getChildren().filter(monster => {
        const inRange = monster.x < this.player.x && monster.x > this.player.x - attackRange &&
                        Math.abs(monster.y - this.player.y) < verticalTolerance;
        if (inRange) console.log("Monster in range at:", monster.x, monster.y);
        return inRange;
      });
    } else if (this.lastDirection === "up") {
      effectY = this.player.y - 30;
      monstersInRange = this.monsters.getChildren().filter(monster => {
        const inRange = monster.y < this.player.y && monster.y > this.player.y - attackRange &&
                        Math.abs(monster.x - this.player.x) < verticalTolerance;
        if (inRange) console.log("Monster in range at:", monster.x, monster.y);
        return inRange;
      });
    } else if (this.lastDirection === "down") {
      effectY = this.player.y + 30;
      monstersInRange = this.monsters.getChildren().filter(monster => {
        const inRange = monster.y > this.player.y && monster.y < this.player.y + attackRange &&
                        Math.abs(monster.x - this.player.x) < verticalTolerance;
        if (inRange) console.log("Monster in range at:", monster.x, monster.y);
        return inRange;
      });
    }
    
          // Create attack effect
    createSimpleEffect(this, effectX, effectY, EFFECT_COLORS.ATTACK);
    
    console.log("Monsters in range:", monstersInRange.length);
    
    // Calculate player attack power with level scaling
    const baseAttack = 10 + (this.playerStats.level - 1) * 2;
    const randomFactor = Phaser.Math.Between(-2, 3);
    const attackPower = baseAttack + randomFactor;
    
    monstersInRange.forEach(monster => {
      monster.takeDamage(attackPower);
    });
  };

  this.cameras.main.startFollow(this.player);
  this.cameras.main.setZoom(2);

  // Monster animations
  this.anims.create({
    key: "monster_idle",
    frames: this.anims.generateFrameNumbers("hickory_idle", { start: 0, end: 5 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "monster_walk",
    frames: this.anims.generateFrameNumbers("hickory_walk", { start: 0, end: 5 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "monster_attack",
    frames: this.anims.generateFrameNumbers("hickory_attack", { start: 0, end: 5 }),
    frameRate: 10,
    repeat: -1
  });

  // Crate break animation
  this.anims.create({
    key: "crate_break",
    frames: this.anims.generateFrameNumbers("loot_crate", { start: 1, end: 4 }),
    frameRate: 10,
    repeat: 0
  });

  this.monsters = this.physics.add.group();
  if (this.obstacles && this.obstacles.getLength() > 0) {
    this.physics.add.collider(this.monsters, this.obstacles);
  }

  // Enhanced monster spawning with level scaling
  if (this.currentZone === "Outer Grasslands") {
    this.monsterSpawnTimer = this.time.addEvent({
      delay: 5000,
      callback: this.spawnMonster,
      callbackScope: this,
      loop: true
    });
  }

  // Set up camera and viewport
  const cam = this.cameras.main;
  const visibleWidth = cam.width / cam.zoom;
  const visibleHeight = cam.height / cam.zoom;
  const frameX = (this.cameras.main.width - visibleWidth) / 2;
  const frameY = (this.cameras.main.height - visibleHeight) / 2;
  this.frameRect = new Phaser.Geom.Rectangle(frameX, frameY, visibleWidth, visibleHeight);
  
  // Create stylish frame
  this.frame = this.add.graphics();
  this.frame.lineStyle(4, 0xffffff, 1);
  this.frame.strokeRect(frameX, frameY, visibleWidth, visibleHeight);
  
  // Add inner stroke for style
  this.frame.lineStyle(2, 0x000000, 0.5);
  this.frame.strokeRect(frameX + 2, frameY + 2, visibleWidth - 4, visibleHeight - 4);
  
  this.frame.setScrollFactor(0);
  this.frame.setDepth(10000);
  
  // Improved HUD
  this.hudText = this.add.text(frameX + 10, frameY + visibleHeight - 10, "", {
    font: "16px Arial",
    fill: "#ffffff",
    stroke: "#000000",
    strokeThickness: 3
  });
  this.hudText.setOrigin(0, 1);
  this.hudText.setScrollFactor(0);
  this.hudText.setDepth(11000);

  // Log system with better visibility
  this.logMessages = [];
  this.logText = this.add.text(frameX + visibleWidth - 10, frameY + 10, "Loot Log Initialized", {
    font: "12px Arial",
    fill: "#ff9900",
    stroke: "#000000",
    strokeThickness: 2,
    align: "right",
    wordWrap: { width: 200 }
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(12000);

  // Add mini-map if in scavenger zones (not village)
  if (this.currentZone !== "Village") {
    const mapSize = 100;
    const mapX = frameX + visibleWidth - mapSize - 10;
    const mapY = frameY + visibleHeight - mapSize - 10;
    
    // Create mini-map background
    this.miniMap = this.add.graphics()
      .fillStyle(0x000000, 0.5)
      .fillRect(mapX, mapY, mapSize, mapSize)
      .lineStyle(2, 0xffffff, 0.8)
      .strokeRect(mapX, mapY, mapSize, mapSize)
      .setScrollFactor(0)
      .setDepth(12000);
    
    // Create player dot on mini-map
    this.miniMapPlayer = this.add.circle(0, 0, 3, 0x00ff00)
      .setScrollFactor(0)
      .setDepth(12001);
    
    // Update mini-map in update function
    this.updateMiniMap = () => {
      if (!this.miniMapPlayer || !this.player || !this.background) return;
      
      // Scale player position to mini-map
      const mapRatioX = mapSize / this.background.displayWidth;
      const mapRatioY = mapSize / this.background.displayHeight;
      
      const miniX = mapX + this.player.x * mapRatioX;
      const miniY = mapY + this.player.y * mapRatioY;
      
      this.miniMapPlayer.setPosition(miniX, miniY);
      
      // Update monster dots on minimap
      if (this.miniMapMonsters) {
        this.miniMapMonsters.forEach(dot => dot.destroy());
      }
      
      this.miniMapMonsters = [];
      if (this.monsters) {
        this.monsters.getChildren().forEach(monster => {
          const dotX = mapX + monster.x * mapRatioX;
          const dotY = mapY + monster.y * mapRatioY;
          
          const dot = this.add.circle(dotX, dotY, 2, 0xff0000)
            .setScrollFactor(0)
            .setDepth(12001);
            
          this.miniMapMonsters.push(dot);
        });
      }
      
      // Add loot crates to minimap
      if (this.miniMapCrates) {
        this.miniMapCrates.forEach(dot => dot.destroy());
      }
      
      this.miniMapCrates = [];
      if (this.lootCrates) {
        this.lootCrates.getChildren().forEach(crate => {
          const dotX = mapX + crate.x * mapRatioX;
          const dotY = mapY + crate.y * mapRatioY;
          
          const dot = this.add.circle(dotX, dotY, 2, 0xffff00)
            .setScrollFactor(0)
            .setDepth(12001);
            
          this.miniMapCrates.push(dot);
        });
      }
    };
  }

  // Game controls
  this.keys = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    interact: Phaser.Input.Keyboard.KeyCodes.I,
    z: Phaser.Input.Keyboard.KeyCodes.Z,
    v: Phaser.Input.Keyboard.KeyCodes.V,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    t: Phaser.Input.Keyboard.KeyCodes.T, // Time setting
    i: Phaser.Input.Keyboard.KeyCodes.I, // Inventory shortcut
    m: Phaser.Input.Keyboard.KeyCodes.M  // Map toggle
  });

  // Create loot groups and spawn initial objects in non-village zones
  if (zoneData.name !== "Village") {
    this.lootCrates = this.physics.add.group({ immovable: true, allowGravity: false });
    
    // Create exclamations group (now tracking array, not physics)
    this.exclamationSprites = [];
    
    // Scale spawns with player level
    const baseCount = 6;
    const levelBonus = Math.floor((this.playerStats.level - 1) * 0.7);
    spawnMultipleLootCrates(this, baseCount + levelBonus);
    spawnMultipleExclamations(this, 6);
    
    // Periodic spawning of new resources
    this.time.addEvent({
      delay: 30000,
      callback: () => spawnMultipleLootCrates(this, 1 + Math.floor(this.playerStats.level / 3)),
      callbackScope: this,
      loop: true
    });
    
    this.time.addEvent({
      delay: 15000,
      callback: () => spawnMultipleExclamations(this, 1),
      callbackScope: this,
      loop: true
    });
  }

  // Enhanced crate hit function with better feedback
  this.hitCrate = (crate) => {
    if (crate.getData('breaking')) return;

    let health = crate.getData('health');
    health -= 1;
    crate.setData('health', health);
    
    // Visual feedback for hit
    crate.setTint(0xff9900);
    this.time.delayedCall(100, () => crate.clearTint());
    
    // Camera shake
    this.cameras.main.shake(50, 0.003);

    if (health <= 0) {
      crate.setData('breaking', true);
      
      // Determine loot with level consideration
      const loot = getRandomLootForZone(this);
      if (loot) {
        addToInventory(this, loot);
        addToLog(this, `Received: ${loot}`);
        
        // Visual loot explosion
        createSimpleEffect(this, crate.x, crate.y, EFFECT_COLORS.LOOT);
      } else {
        addToLog(this, "No loot found");
      }
      
      crate.play('crate_break');
      crate.once('animationcomplete', () => {
        crate.destroy();
      });
    } else {
      console.log(`Crate hit, health remaining: ${health}`);
    }
  };

  // Load narrative data
  this.narrativePrologues = this.cache.json.get("narrativePrologues");
  this.narrativeData = this.cache.json.get("narrativePrompts");

  // Dialog and UI elements
  this.dialogBg = this.add.graphics();
  this.dialogBg.setDepth(1600);
  this.dialogBg.setVisible(false);
  
  this.dialogText = this.add.text(0, 0, "", {
    font: "14px Arial",
    fill: "#ffffff",
    wordWrap: { width: 240 },
    stroke: "#000000",
    strokeThickness: 3
  });
  
  this.dialogText.setDepth(1601);
  this.dialogText.setVisible(false);
  this.buttons = [];
  this.narrativeScreen = SCREEN_NONE;
  this.activePrompt = null;
  this.chosenOptionIndex = -1;

  // Add player collisions
  if (this.obstacles && this.obstacles.getLength() > 0) {
    this.physics.add.collider(this.player, this.obstacles);
  }

  updateHUD(this);

  // Handle fade-in after death with better transition
  if (this.scene.settings.data.fromDeath) {
    this.cameras.main.setAlpha(0);
    this.add.tween({
      targets: this.cameras.main,
      alpha: 1,
      duration: 1500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Simple resurrection effect
        createSimpleEffect(this, this.player.x, this.player.y, 0xffffff);
      }
    });
  } else {
    // Normal zone transition
    this.cameras.main.fadeIn(500);
  }

  console.log("createScene: gameTime:", this.registry.get('gameTime'));

  // Set up camping prompt timer (10 seconds)
  this.time.delayedCall(10000, () => {
    const gameTime = this.registry.get('gameTime');
    const gameHour = (6 + Math.floor(gameTime / this.secondsPerHour)) % 24;
    const isNearNight = gameHour === 18; // 6 PM
    
    if (!this.hasPromptedCamping && hasCampingMaterials(this) && this.currentZone !== "Village" && isNearNight) {
      this.hasPromptedCamping = true;
      showDialog(this, "Night is approaching. Would you like to set up camp?");
      const options = [
        {
          label: "Yes, set up camp",
          callback: () => initiateCampingSetup(this)
        },
        {
          label: "No, not now",
          callback: () => hideDialog(this)
        }
      ];
      createScrollableMenu(this, "Camping Prompt", options);
    }
  });

  this.player.anims.play("idle-down", true);

  updateHUD(this);
  setupFPSCounter(this);
  
  // Add a Shady Grove Map to inventory for testing the new travel functionality
  if (zoneData.name === "Outer Grasslands") {
    // Check if player already has the map
    const hasMap = this.localInventory.some(item => 
      item.name.toLowerCase() === "shady grove map" && item.quantity > 0
    );
    
    // Add map if not already in inventory
    if (!hasMap) {
      this.localInventory.push({
        name: "Shady Grove Map",
        quantity: 1
      });
      console.log("Added Shady Grove Map to inventory for testing");
    }
  }
  
  // Add an Arid Desert Map to inventory for testing the new travel functionality
  if (zoneData.name === "Shady Grove") {
    // Check if player already has the map
    const hasMap = this.localInventory.some(item => 
      item.name.toLowerCase() === "arid desert map" && item.quantity > 0
    );
    
    // Add map if not already in inventory
    if (!hasMap) {
      this.localInventory.push({
        name: "Arid Desert Map",
        quantity: 1
      });
      console.log("Added Arid Desert Map to inventory for testing");
    }
  }
}

function spawnMonster() {
  console.log("spawnMonster called");
  
  // Only spawn at night in wilderness zones with level-based limit
  if (this.isNight && this.currentZone === "Outer Grasslands") {
    const playerLevel = this.playerStats.level || 1;
    const maxMonsters = 3 + Math.floor(playerLevel / 2);
    
    if (this.monsters.getLength() < maxMonsters) {
      let x, y, validSpawn = false;
      let tries = 0;
      const MAX_TRIES = 100;
      
      while (!validSpawn && tries < MAX_TRIES) {
        // Spawn within a reasonable area of the world
        const worldW = this.background ? this.background.displayWidth : 800;
        const worldH = this.background ? this.background.displayHeight : 600;
        
        x = Phaser.Math.Between(50, worldW - 50);
        y = Phaser.Math.Between(50, worldH - 50);
        
        // More relaxed distance requirements
        let playerDistance = 250;
        if (this.player && this.player.x !== undefined) {
          playerDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
        }
        
        // Don't spawn too close but less restrictive on distance
        if (playerDistance > 150 && playerDistance < 800 && !overlapsObstacle(this, x, y, 40)) {
          validSpawn = true;
        }
        tries++;
      }
      
      if (validSpawn) {
        console.log("Monster spawned at", x, y);
        const monster = new Monster(this, x, y);
        this.monsters.add(monster);
        
        // Simple spawn effect
        createSimpleEffect(this, x, y, 0x330000);
      } else {
        console.log("Failed to find a valid spawn location after", MAX_TRIES, "tries");
      }
    } else {
      console.log(`Max monsters (${maxMonsters}) already spawned`);
    }
  } else {
    console.log("Spawn conditions not met: isNight=", this.isNight, "zone=", this.currentZone, "monsters=", this.monsters ? this.monsters.getLength() : 0);
  }
}

function handlePlayerDeath(scene) {
  scene.isRestarting = true;
  scene.isDying = true;
  
  // Death sequence with effects
  scene.player.setTint(0xff0000);
  scene.cameras.main.shake(500, 0.03);
  scene.cameras.main.flash(300, 255, 0, 0);
  
  showDialog(scene, "You have died!\nYou wake up in Village Commons...\nAll your items have been lost!");
  
  // Simple death effect
  createSimpleEffect(scene, scene.player.x, scene.player.y, 0xff0000);
  
  scene.time.delayedCall(2000, () => {
    const fadeTween = scene.tweens.add({
      targets: scene.cameras.main,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        // Cleanup
        hideDialog(scene);
        scene.sound.stopAll();
        scene.tweens.killAll();
        if (scene.monsters) scene.monsters.clear(true, true);
        if (scene.lootCrates) scene.lootCrates.clear(true, true);
        if (scene.exclamations) scene.exclamations.clear(true, true);
        
        // Restart scene
        const villageZone = zoneList.find(z => z.name === "Village");
        if (villageZone) {
          // Preserve level and oromozi, just heal the player
          const currentLevel = scene.playerStats.level || 1;
          const currentExp = scene.playerStats.experience || 0;
          scene.playerStats = createInitialStats(villageZone.name, scene.playerStats.oromozi);
          scene.playerStats.level = currentLevel;
          scene.playerStats.experience = currentExp;
          
          // Clear inventory when player dies
          scene.localInventory = [];
          
          // Add starting camping materials
          scene.localInventory.push({ name: "Cloth", quantity: 1 });
          scene.localInventory.push({ name: "Stick", quantity: 2 });
          
          scene.scene.restart({ zone: villageZone, inventory: scene.localInventory, fromDeath: true, promptCount: 0 });
        } else {
          console.error("Village zone not found!");
        }
      }
    });
  });
}

function updateScene(time, delta) {
  if (this.isRestarting) return;
  
  if (!this.player || !this.player.body) return;

  // Update game time
  let gameTime = this.registry.get('gameTime') || 0;
  gameTime += delta / 1000;
  this.registry.set('gameTime', gameTime % this.secondsPerDay);
  const gameHour = (6 + Math.floor(gameTime / this.secondsPerHour)) % 24;
  this.isNight = gameHour >= 20 || gameHour < 6;
  
  // Reset camping prompt at the start of each new day (6 AM)
  if (gameHour === 6) {
    this.hasPromptedCamping = false;
  }
  
  // Update time display in HUD with safety checks and proper recreation
  const hour = gameHour % 12 === 0 ? 12 : gameHour % 12;
  const ampm = gameHour < 12 ? "AM" : "PM";
  const timeString = `${hour}:00 ${ampm}`;
  
  try {
    if (this.timeText && this.timeText.active) {
      this.timeText.setText(timeString);
    } else {
      // Create a new timeText if it doesn't exist or was destroyed
      if (this.timeText) this.timeText.destroy();
      
      this.timeText = this.add.text(10, 10, timeString, {
        font: "12px Arial",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2
      }).setScrollFactor(0).setDepth(12000);
    }
  } catch (error) {
    console.warn("Error with time display, recreating:", error);
    try {
      // Last resort - recreate from scratch with no text
      if (this.timeText) this.timeText.destroy();
      this.timeText = this.add.text(10, 10, "", {
        font: "12px Arial",
        fill: "#ffffff",
      }).setScrollFactor(0).setDepth(12000);
      
      // Set text in next frame
      this.time.delayedCall(100, () => {
        if (this.timeText && this.timeText.active) {
          this.timeText.setText(timeString);
        }
      });
    } catch (err) {
      console.error("Failed to recreate time display:", err);
    }
  }

  // Update day/night transition
  if (this.isNight && !this.wasNight) {
    this.tweens.add({
      targets: this.nightOverlay,
      alpha: 0.8,
      duration: 5000,
      ease: 'Linear'
    });
    
    // Fade in stars
    this.stars.forEach(star => {
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.Between(3, 9) * 0.1,
        duration: 3000,
        ease: 'Linear'
      });
    });
  } else if (!this.isNight && this.wasNight) {
    this.tweens.add({
      targets: this.nightOverlay,
      alpha: 0,
      duration: 5000,
      ease: 'Linear'
    });
    
    // Fade out stars
    this.stars.forEach(star => {
      this.tweens.add({
        targets: star,
        alpha: 0,
        duration: 3000,
        ease: 'Linear'
      });
    });
  }
  this.wasNight = this.isNight;

  // Update player shadow
  if (this.playerShadow) {
    this.playerShadow.setPosition(this.player.x, this.player.y + 12);
  }
  
  // Update minimap if exists with safer checks
  if (this.updateMiniMap && this.currentZone !== "Village" && 
      this.player && this.player.x !== undefined && this.player.y !== undefined) {
    try {
      this.updateMiniMap();
    } catch (error) {
      console.warn("Error updating minimap:", error);
    }
  }

  // Camping prompt logic with better timing
  if (gameHour === 18 && !this.hasPromptedCamping && 
      this.currentZone !== "Village" && 
      this.narrativeScreen === SCREEN_NONE) {
    // Store the current time to prevent multiple prompts
    this.lastCampingPromptTime = gameTime;
    this.narrativeScreen = SCREEN_CAMPING_PROMPT;
    showDialog(this, "It's getting dark (6:00 PM), do you want to set up camp?\n(Press SPACE to confirm)");
    this.hasPromptedCamping = true;
  } else if (gameHour !== 18 || (this.lastCampingPromptTime && Math.abs(gameTime - this.lastCampingPromptTime) > this.secondsPerHour)) {
    // Reset the flag when the hour changes or enough time has passed
    this.hasPromptedCamping = false;
    this.lastCampingPromptTime = null;
  }

  // Handle camping prompt interaction
  if (this.narrativeScreen === SCREEN_CAMPING_PROMPT && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
    if (hasCampingMaterials(this)) {
      initiateCampingSetup(this);
      this.narrativeScreen = SCREEN_NONE; // Allow player movement
    } else {
      showDialog(this, "You need 2 sticks and 1 cloth to set up camp.\n(Press SPACE to continue)");
      this.input.keyboard.once("keydown-SPACE", () => {
        hideDialog(this);
        this.narrativeScreen = SCREEN_NONE;
      });
    }
  }

  // Clear monsters safely
  if (this.monsters && (!this.isNight || this.currentZone === "Village")) {
    this.monsters.clear(true, true);
  }

  // Handle player death and scene restart
  if (this.playerStats && this.playerStats.health <= 0 && this.currentZone !== "Village" && !this.isDying) {
    console.log("Player died in Scavenger Mode!");
    handlePlayerDeath(this);
    return;
  }

  // Set time to 5:00 PM when 'T' is pressed
  if (Phaser.Input.Keyboard.JustDown(this.keys.t)) {
    this.registry.set('gameTime', 110); // 11 hours * 10 seconds per hour
    console.log("Time set to 5:00 PM");
  }

  // Zone changing shortcut with better transition
  if (Phaser.Input.Keyboard.JustDown(this.keys.z)) {
    console.log("Switching zone, current gameTime:", this.registry.get('gameTime'));
    currentZoneIndex = (currentZoneIndex + 1) % zoneList.length;
    
    // Add transition effect
    this.cameras.main.fadeOut(500);
    this.time.delayedCall(500, () => {
      this.scene.restart({ zone: zoneList[currentZoneIndex], inventory: this.localInventory, promptCount: this.promptCount });
    });
    return;
  }
  
  // Show inventory on I key press (when not in other dialogs)
  if (Phaser.Input.Keyboard.JustDown(this.keys.i) && this.narrativeScreen === SCREEN_NONE) {
    this.narrativeScreen = SCREEN_ITEM_MENU;
    showItemMenu(this);
    return;
  }

  // Manage foreground layer depth based on player position
  if (this.foreground) {
    const overlapsForeground = Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.foreground.getBounds());
    if (overlapsForeground) {
      this.player.setDepth(this.foreground.depth - 1);
    } else {
      this.player.setDepth(this.foreground.depth + 1);
    }
  }

  // Adjusted condition to only halt for module UI states (7 to 13), not SCREEN_CAMPING_PROMPT (14)
  if (this.narrativeScreen >= SCREEN_LIQUIDITY && this.narrativeScreen <= SCREEN_BATTLE) {
    this.player.setVelocity(0);
    this.player.anims.stop();
    return;
  }

  // Handle different narrative screens
  switch (this.narrativeScreen) {
    case SCREEN_PROLOGUE:
    case SCREEN_PROMPT:
      this.player.setVelocity(0);
      this.player.anims.stop();
      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
        if (this.narrativeScreen === SCREEN_PROLOGUE) {
          this.narrativeScreen = SCREEN_PROMPT;
          showPrompt(this);
        } else if (this.narrativeScreen === SCREEN_PROMPT) {
          this.narrativeScreen = SCREEN_CHOICES;
          showChoices(this);
        }
      }
      return;
      
    case SCREEN_CHOICES:
    case SCREEN_OUTCOME:
    case SCREEN_ITEM_MENU:
    case SCREEN_ITEM_PICK:
      this.player.setVelocity(0);
      this.player.anims.stop();
      if (this.narrativeScreen === SCREEN_OUTCOME && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
        this.narrativeScreen = SCREEN_ITEM_MENU;
        showItemMenu(this);
      }
      return;
      
    default:
      break;
  }

  // Character movement and actions
  const speed = 100; // Increased base speed for better feel
  
  if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
    this.isAttacking = true;
    this.player.setVelocity(0);
    this.player.anims.play(`attack-${this.lastDirection}`, true);
    
    // Camera effect for attack
    this.cameras.main.shake(50, 0.005);
    
    this.applyAttackDamage(); // Call directly for immediate feedback
    
    // Check for crate interactions during attack
    if (this.lootCrates && this.currentZone !== "Village") {
      const crates = this.lootCrates.getChildren();
      const attackRange = 60; // Increased range for better hit detection
      
      for (let crate of crates) {
        const distance = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, crate.x, crate.y
        );
        
        if (distance < attackRange) {
          console.log("Player in range of crate, hitting...");
          this.hitCrate(crate);
          break; // Hit only one crate per spacebar press
        }
      }
    }
  }

  if (!this.isAttacking) {
    this.player.setVelocity(0);
    
    // Movement with slight acceleration for better feel
    let currentSpeed = speed;
    if (this.playerStats.stamina < 30) {
      currentSpeed = speed * 0.7; // Slow down when low on stamina
    }
    
    if (this.keys.left.isDown) {
      this.player.setVelocityX(-currentSpeed);
      this.player.anims.play("walk-left", true);
      this.lastDirection = "left";
    } else if (this.keys.right.isDown) {
      this.player.setVelocityX(currentSpeed);
      this.player.anims.play("walk-right", true);
      this.lastDirection = "right";
    } else if (this.keys.up.isDown) {
      this.player.setVelocityY(-currentSpeed);
      this.player.anims.play("walk-up", true);
      this.lastDirection = "up";
    } else if (this.keys.down.isDown) {
      this.player.setVelocityY(currentSpeed);
      this.player.anims.play("walk-down", true);
      this.lastDirection = "down";
    } else {
      this.player.setVelocity(0);
      if (this.lastDirection === "down") {
        this.player.anims.play("idle-down", true);
      } else if (this.lastDirection === "up") {
        this.player.anims.play("idle-up", true);
      } else if (this.lastDirection === "left") {
        this.player.anims.play("idle-left", true);
      } else if (this.lastDirection === "right") {
        this.player.anims.play("idle-right", true);
      }
    }
  }

  // Interact with exclamation points
  if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
    const ex = getOverlappingExclamation(this);
    if (ex) {
      console.log("Interacting with ex at:", ex.x, ex.y);
      
      // Simple visual effect when interacting
      createSimpleEffect(this, ex.x, ex.y, 0xffffff);
      
      ex.destroy();
      this.narrativeScreen = SCREEN_PROLOGUE;
      showPrologue(this);
    } else {
      console.log("Interact pressed, but no exclamation overlap.");
    }
  }
}

/* =======================================================
   11) PHASER SCENE CLASSES & CONFIG
======================================================= */
class MainGameScene extends Phaser.Scene {
  constructor() {
    super('MainGameScene');
  }

  preload() {
    preload.call(this);
  }

  create() {
    // Only initialize with default inventory if no scene data passed
    if (!this.scene.settings.data || !this.scene.settings.data.inventory) {
      this.localInventory = [
        { name: "Cloth", quantity: 1 },
        { name: "Stick", quantity: 2 }
      ];
    } else {
      // Make sure we properly assign the inventory from scene data
      this.localInventory = this.scene.settings.data.inventory;
      console.log("Using inventory from scene data:", this.localInventory);
    }
    
    // Add crafting materials for testing if in Village zone
    if (this.scene.settings.data && 
        this.scene.settings.data.zone && 
        this.scene.settings.data.zone.name === "Village") {
      
      // Add ingredients to craft multiple items
      const craftingMaterials = [
        { name: "Wood", quantity: 5 },
        { name: "Iron Ore", quantity: 2 },
        { name: "Stone", quantity: 3 },
        { name: "Herbs", quantity: 2 },
        { name: "Water", quantity: 2 },
        { name: "Vines", quantity: 1 },
        { name: "Thread", quantity: 2 },
        { name: "Leather", quantity: 1 }
      ];
      
      // Add each material to inventory, merging with existing quantities
      craftingMaterials.forEach(material => {
        const existingItem = this.localInventory.find(item => item.name === material.name);
        if (existingItem) {
          existingItem.quantity += material.quantity;
        } else {
          this.localInventory.push({ name: material.name, quantity: material.quantity });
        }
      });
      
      console.log("Added crafting materials to inventory:", this.localInventory);
    }
    
    createScene.call(this);
  }

  update(time, delta) {
    updateScene.call(this, time, delta);
  }

  spawnMonster() {
    spawnMonster.call(this);
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  preload() {
    for (let i = 1; i <= 113; i++) {
      this.load.image(`frame_${i}`, `assets/menu/frame (${i}).png`);
    }
  }

  create() {
    let frames = [];
    for (let i = 1; i <= 113; i++) {
      frames.push({ key: `frame_${i}` });
    }

    this.anims.create({
      key: 'menuAnimation',
      frames: frames,
      frameRate: 24,
      repeat: -1
    });

    let gifSprite = this.add.sprite(
      this.game.config.width / 2,
      this.game.config.height / 2,
      'frame_1'
    );
    gifSprite.setOrigin(0.5);

    const texture = this.textures.get('frame_1');
    const frame = texture.getSourceImage();
    const imageWidth = frame.width;
    const imageHeight = frame.height;

    const scaleX = this.game.config.width / imageWidth;
    const scaleY = this.game.config.height / imageHeight;
    const scale = Math.min(scaleX, scaleY);

    gifSprite.setScale(scale);
    gifSprite.play('menuAnimation');

    // Enhanced title
    const titleText = this.add.text(
      this.game.config.width / 2,
      this.game.config.height * 0.3,
      'SCAVENGER QUEST',
      { 
        font: '48px Arial', 
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
      }
    ).setOrigin(0.5);
    
    // Add title glow effect
    this.tweens.add({
      targets: titleText,
      alpha: { from: 0.8, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1
    });

    // Enhanced start prompt
    const promptText = this.add.text(
      this.game.config.width / 2,
      this.game.config.height * 0.9,
      'Press Enter to Begin',
      { 
        font: '32px Arial', 
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4 
      }
    ).setOrigin(0.5);
    
    // Add pulse animation
    this.tweens.add({
      targets: promptText,
      scale: { from: 1, to: 1.1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Start game on Enter
    this.input.keyboard.on('keydown-ENTER', () => {
      this.cameras.main.fadeOut(500);
      this.time.delayedCall(500, () => {
        const villageZone = zoneList.find(z => z.name === "Village");
        if (villageZone) {
          this.scene.start('MainGameScene', { zone: villageZone });
        } else {
          console.error("Village zone not found!");
        }
      });
    });
  }
}

// CampingScene is already loaded from the campingScene.js file in the HTML
// No need to declare it again, just reference it

// FishingScene is already loaded from the fishingScene.js file in the HTML
// No need to declare it again, just reference it

// DungeonScene is now loaded from the dungeonScene.js file in the HTML
// No need to define it here, just reference it

// Game configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'phaser-game',
    width: 800,
    height: 600,
    minWidth: 320,
    minHeight: 240,
    maxWidth: 800,
    maxHeight: 600
  },
  scene: [MenuScene, MainGameScene, CampingScene, FishingScene, DungeonScene]
};

// Wait for document to be fully loaded before creating the game
window.onload = function() {
  const game = new Phaser.Game(config);
};

function initiateCampingSetup(scene) {
  console.log("Initiating camping setup...");
  hideDialog(scene);
  
  // Remove camping materials from inventory
  removeFromInventory(scene, "Stick", 2);
  removeFromInventory(scene, "Cloth", 1);
  updateHUD(scene);
  
  // Create progress container at player's position
  const progressContainer = scene.add.container(scene.player.x, scene.player.y - 40);
  progressContainer.setDepth(10000);
  
  // Create background (smaller size)
  const bg = scene.add.rectangle(0, 0, 150, 60, 0x000000, 0.7);
  progressContainer.add(bg);
  
  // Create title text (smaller font)
  const titleText = scene.add.text(0, -20, "Setting up camp...", {
    font: "16px Arial",
    fill: "#ffffff",
    stroke: "#000000",
    strokeThickness: 2
  }).setOrigin(0.5);
  progressContainer.add(titleText);
  
  // Create progress bar background (smaller size)
  const progressBg = scene.add.rectangle(0, 10, 120, 8, 0x333333);
  progressContainer.add(progressBg);
  
  // Create progress bar (smaller size)
  const progressBar = scene.add.rectangle(-60, 10, 0, 8, 0x00ff00);
  progressBar.setOrigin(0, 0.5);
  progressContainer.add(progressBar);
  
  // Create progress text (smaller font)
  const progressText = scene.add.text(0, 25, "0%", {
    font: "14px Arial",
    fill: "#ffffff",
    stroke: "#000000",
    strokeThickness: 2
  }).setOrigin(0.5);
  progressContainer.add(progressText);
  
  // Set up timer (90 seconds for actual camp setup)
  let elapsedTime = 0;
  const totalTime = 90;
  
  const timer = scene.time.addEvent({
    delay: 1000,
    callback: () => {
      elapsedTime++;
      const progress = (elapsedTime / totalTime) * 100;
      
      // Update progress bar
      progressBar.width = (progress / 100) * 120;
      
      // Update progress text
      progressText.setText(`${Math.floor(progress)}%`);
      
      // When complete, change color and make interactive
      if (progress >= 100) {
        progressBar.setFillStyle(0x00ff00);
        progressText.setText("ENTER CAMP");
        progressText.setInteractive();
        progressText.on('pointerdown', () => {
          // Clean up UI elements
          timer.destroy();
          progressContainer.destroy();
          
          // Transition to camping scene
          const currentZone = zoneList.find(z => z.name === scene.currentZone);
          scene.scene.start('CampingScene', {
            inventory: scene.localInventory,
            playerStats: scene.playerStats,
            zone: currentZone,
            isFireLit: false
          });
        });
      }
    },
    loop: true
  });
  
  // Handle ESC key to cancel
  const escHandler = () => {
    // Return materials to inventory
    addToInventory(scene, "Stick", 2);
    addToInventory(scene, "Cloth", 1);
    updateHUD(scene);
    
    // Clean up
    timer.destroy();
    progressContainer.destroy();
    scene.input.keyboard.removeListener('keydown-ESC', escHandler);
    
    // Show cancellation message
    showDialog(scene, "Camping setup cancelled.\n(Press SPACE to continue)");
    scene.input.keyboard.once("keydown-SPACE", () => {
      hideDialog(scene);
    });
  };
  
  scene.input.keyboard.on('keydown-ESC', escHandler);
}

// Added function to calculate battle statistics based on player state
function calculateBattleStats(scene) {
  if (!scene || !scene.playerStats) {
    // Return default values if scene or playerStats not available
    return { attack: 10, defense: 5 };
  }
  
  // Base stats that scale with level
  const baseAttack = 10 + (scene.playerStats.level - 1) * 2;
  const baseDefense = 5 + (scene.playerStats.level - 1);
  
  // Add any equipped item bonuses (if available)
  const attackBonus = scene.playerStats.attackBonus || 0;
  const defenseBonus = scene.playerStats.defenseBonus || 0;
  
  return {
    attack: baseAttack + attackBonus,
    defense: baseDefense + defenseBonus
  };
}

// Add function to setup FPS counter for debugging
function setupFPSCounter(scene) {
  // Check if we're in development mode or should show FPS
  const showFPS = false; // Set to true to enable FPS counter
  
  if (showFPS && scene.add) {
    try {
      scene.fpsText = scene.add.text(
        scene.cameras.main.width - 60, 
        5, 
        'FPS: --', 
        { 
          font: '12px Arial', 
          fill: '#ffff00',
          stroke: '#000000',
          strokeThickness: 1
        }
      );
      scene.fpsText.setScrollFactor(0);
      scene.fpsText.setDepth(9999);
      
      // Update FPS every 500ms
      scene.time.addEvent({
        delay: 500,
        callback: () => {
          if (scene.fpsText && scene.game) {
            scene.fpsText.setText(`FPS: ${Math.round(scene.game.loop.actualFps)}`);
          }
        },
        callbackScope: scene,
        loop: true
      });
    } catch (error) {
      console.warn("Error setting up FPS counter:", error);
    }
  }
}

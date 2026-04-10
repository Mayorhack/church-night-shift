
## Church Overnight Work Schedule App

### Overview
A single-user scheduling tool for managing 6-week church overnight work rotations for Light and Sound units, with auto-rotation and manual override capabilities.

### Crew Requirements
| Shift | Sound | Light |
|-------|-------|-------|
| Overnight | 5–6 people | 2 people |
| Morning Setup | 2 people | 1 person |

### Pages & Features

#### 1. **Team Roster Page**
- Add/remove/edit volunteer members
- Assign each member to a unit (Light or Sound)
- Mark availability (available for overnight, morning, or both)
- Data stored in localStorage

#### 2. **Schedule Generator**
- Select a 6-week date range (start date)
- Auto-generate a fair rotation schedule that:
  - Distributes shifts evenly across volunteers
  - Fills overnight slots (5–6 Sound, 2 Light) and morning setup slots (2 Sound, 1 Light)
  - Avoids back-to-back weeks where possible
- One-click "Generate Schedule" button

#### 3. **Schedule View & Edit Page**
- 6-week table/grid showing each week's assignments
- Columns: Week #, Date, Overnight Sound, Overnight Light, Morning Sound, Morning Light
- Click any slot to manually swap or reassign a volunteer (dropdown of available members)
- Visual indicators for any unfilled slots

#### 4. **Dashboard (Home Page)**
- Current week's schedule highlighted
- Quick stats: total volunteers, upcoming week preview

### Design
- Clean, church-friendly design with a warm color palette
- Responsive layout for desktop use
- All data persisted in browser localStorage

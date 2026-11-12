/**
 * Level 1: the haunted house, drawn as text. Each character is one 16x16 tile.
 *
 *   #  stone wall / floor (solid)   X  crate or barrel (solid)
 *   =  wooden shelf (jump up through it)
 *   H  ladder (Up/Down)              /  \  stairs (walk up them)
 *   *  gem                           G  gun pickup
 *   S  rock salt shotgun pickup (the only thing that hurts ghosts)
 *   m  machete pickup (cuts down zombies; the only thing that hurts a vampire)
 *   K  key (opens the exit door)     D  exit door
 *   P  player start                  z  zombie (walks)
 *   g  ghost (floats; flies after the player, through any open space)
 *   V  vampire: guards its stretch of floor, and the exit door won't open
 *      while it stands. Put it a few tiles in front of the door.
 *   T  trapdoor: put it in a floor, in place of a #. It looks almost exactly like
 *      the floor around it, and drops the player into a pit of snakes. A run of
 *      T is one wide trapdoor. Zombies are too light to set one off.
 *   h  secret hatch: put it in a floor, in place of the top H of a ladder. It is
 *      floor, hidden under a rug, until the player pulls the loose book (B); then
 *      it swings open onto the ladder. Enemies treat it as floor until then too.
 *   B  the loose book, on a library bookcase (L). Standing in front of it, E (or
 *      the USE button on touch screens) pulls it and opens the nearest hatch, even
 *      one on another floor.
 *
 * Decorations (no collision, drawn behind the player):
 *
 *   w  window; draw it 2x2 (ww on two rows)   %  cobweb; put it in a corner
 *   f  portrait                                b  bookcase; two rows tall
 *   c  candle on a wall sconce
 *   L  library bookcase; stack them as tall as you like (cornice on top, cupboard at the floor)
 *   a  reading armchair
 *   v  air vent, high on a wall. Tentacles reach out of it now and then.
 *   M  the thing in the cupboard under the stairs; its bottom-left tile, inside a
 *      solid block at least 2x2. Counts as wall.
 *
 * How # looks is picked automatically: floorboards when there is a room above it,
 * roof shingles when there is sky above it, flagstones in the cellar, plain stone
 * otherwise. Empty space joined to the top edge of the map is sky; the rest is
 * inside the house and gets the wallpaper of its zone (see ZONES), with wood
 * panelling along the bottom of each wall.
 *
 * Every row must be the same length. Leave two empty tiles above any floor,
 * stair or ladder top so the player (24px tall) fits. Shelves sit three tiles
 * above a floor; the player can jump four.
 *
 * Stairs: a run of / climbs up to the right, a run of \ climbs up to the left,
 * one tile up per tile across. The floor at the top of a run is level with the
 * last stair, and the floor at the bottom is one row below the first.
 *
 * Ladders: the top H of a ladder can be stood on, so a ladder can poke up
 * through a hole in a floor. Press Down on it to climb back down.
 *
 * The route: start in the entrance hall (the gun is on the shelf just to the
 * west, with a zombie waiting at the foot of the stairs), up the grand staircase
 * to the rock salt shotgun on the landing at the top (before the first ghost,
 * which haunts the far end of that room), east along the upstairs landing, up the
 * ladder into the attic for the key, then drop through the broken floorboards
 * into the west bedroom, pull the loose book on its bookcase to open the secret
 * hatch under the rug in the library, down through the hole in the floor to the
 * hall and on into the library, climb down into the cellar, pick up the machete
 * stuck in the crates, and up into the east wing, where the vampire guards the door.
 *
 * The map is a raw string (so \ needs no escaping), split into rows below.
 */
const MAP = String.raw`
                                                                      ##                            
                        ##                                            ##                            
                        ##                                            ##                            
              ########################################################################              
            ##%                                                                      %##            
          ##                                                                            ##          
        ##                   * *                 **                          * *          ##        
      ##                    =====       g       ====              g         =====           ##      
    ##                           c                  ww          c                             ##    
  ##                  XX             X              ww    XXX                                   ##  
##      K   *         XX      z     XX                    XXX                                     ##
################  ##########################TTT#######################TT##################H#########
#%                                     %#             %                 #                 H       %#
#                         v       ww    #                               #         v       H        #
#         ww                      ww    #               ww              #           g ww  H        #
#   c     ww LL f   g     c             #               ww    c    gf   # c   f       ww  H c      #
#      * *   LL                   **    #                    **         #        * *      H        #
#     =====  LB                         #                   ====         %      =====     H    *   #
#            LL                      b  #                                                 H        #
#            LL                      b  #              S                    z             H   * *  #
######################TT######  ############        /#############TTT###############################
#%            #%                  #       %        /##%                     #%                     #
#  c     c    #     v             #               /###      v               #                      #
#LL    ww   LL#         f   f     #     f        /####        ww            #         f     ww     #
#LL    ww   LL#           c       #             /#####        ww  c   g   c #               ww    c#
#LL         LL#     G             #  * *       /######               * *    #            **        #
#LL         LL    =====             =====     /#######              =====               ====       #
#LL         LL  b               b            /########                        b                    #
#LL      a  LL  b     * * P     b        z  /###M#####                        b z           V   D  #
######h###################################################H#####TT##################TTT#############
#%    H                       v                          %H       v                               %#
#     H                                                   H                                        #
#     H                                                   H                                        #
#     H    ** c                      * *      c           H                    **   c              #
#     H   ====                      ===== m         g     H                   ====                 #
#     H                                   XX              H                                   * *  #
#* *  H                       z           XX              H     z                           X      #
##################TTT###  ######################TT####################   ###############TTT#########
`;

/** Wallpaper zones, top to bottom: each starts at a row and runs until the next. */
export type BackStyle = 'attic' | 'upstairs' | 'downstairs' | 'cellar';

export interface Level {
  rows: string[];
  zones: { fromRow: number; style: BackStyle }[];
}

export const LEVEL_1: Level = {
  rows: MAP.split('\n').filter((row) => row.length > 0),
  zones: [
    { fromRow: 0, style: 'attic' },
    { fromRow: 12, style: 'upstairs' },
    { fromRow: 21, style: 'downstairs' },
    { fromRow: 30, style: 'cellar' },
  ],
};

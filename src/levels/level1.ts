/**
 * Level 1: the haunted house, drawn as text. Each character is one 16x16 tile.
 *
 *   #  stone wall / floor (solid)   X  crate or barrel (solid)
 *   =  wooden shelf (jump up through it)
 *   H  ladder (Up/Down)              /  \  stairs (walk up them)
 *   *  gem                           G  gun pickup
 *   S  rock salt shotgun pickup (the only thing that hurts ghosts)
 *   K  key (opens the exit door)     D  exit door
 *   P  player start                  z  zombie (walks)
 *   g  ghost (floats; flies after the player, through any open space)
 *   T  trapdoor: put it in a floor, in place of a #. It looks almost exactly like
 *      the floor around it, and drops the player into a pit of snakes. A run of
 *      T is one wide trapdoor. Zombies are too light to set one off.
 *
 * Decorations (no collision, drawn behind the player):
 *
 *   w  window; draw it 2x2 (ww on two rows)   %  cobweb; put it in a corner
 *   f  portrait                                b  bookcase; two rows tall
 *   c  candle on a wall sconce
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
 * The route: through the downstairs hall (the gun on the first shelf, the
 * rock salt shotgun on the shelf at the foot of the stairs), up the grand staircase, east along the
 * upstairs landing, up the ladder into the attic for the key, then drop through
 * the broken floorboards, down the trapdoor into the cellar, and up into the
 * east wing to the door.
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
#   c     ww    f   g     c             #               ww    c g   f   # c   f       ww  H c      #
#      * *                        **    #                    **         #        * *      H        #
#     =====                             #                   ====         %      =====     H    *   #
#                                    b  #                                                 H        #
#                                    b  #                                   z             H   * *  #
######################TT######  ############        /#############TTT###############################
#%            #%                  #       %        /##%                     #%                     #
#             #     v             #               /###      v               #                      #
#        ww   #         f   f     #     f        /####        ww            #         f     ww     #
# c      ww c #           c       #             /#####        ww  c   g   c #               ww    c#
#             #     G             #  *S*       /######               * *    #            **        #
#                 =====             =====     /#######              =====               ====       #
#               b               b            /########                        b                    #
#  P            b     * *   z   b           /###M#####                        b z               D  #
######H###################################################H#####TT##################TTT#############
#%    H                       v                          %H       v                               %#
#     H                                                   H                                        #
#     H                                                   H                                        #
#     H    ** c                      * *      c           H                    **   c              #
#     H   ====                      =====           g     H                   ====                 #
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

#define SHADER_NAME icon-layer-vertex-shader

attribute vec2 positions;

attribute float instanceSizes;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;
attribute vec4 instanceIconFrames;
attribute float instanceColorModes;
attribute vec2 instanceOffsets;
attribute vec2 instancePixelOffset;

uniform float sizeScale;
uniform vec2 iconsTextureDim;
uniform float sizeMinPixels;
uniform float sizeMaxPixels;
uniform bool billboard;

uniform float currentTime;

attribute float instanceTimestamps;
attribute float instanceTimestampsNext;
attribute vec3 instanceStartPositions;
attribute vec3 instanceEndPositions;

varying float vColorMode;
varying vec4 vColor;
varying vec2 vTextureCoords;
varying vec2 uv;
varying float vPercentComplete;

vec2 rotate_by_angle(vec2 vertex, float angle_radian) {
  // float angle_radian = angle * PI / 180.0;
  float cos_angle = cos(angle_radian);
  float sin_angle = sin(angle_radian);
  mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
  return rotationMatrix * vertex;
}

vec3 interpolate(in vec3 point1, in vec3 point2, in float timestepFraction) {
    if (timestepFraction <= 0.0) {
        return point1;
    } else if (timestepFraction >= 1.0 ) {
        return point2;
    } else {
        vec3 direction = point2 - point1;
        return point1 + (direction * timestepFraction);
    }
}

void main(void) {
  // geometry.worldPosition = instancePositions;
  // geometry.uv = positions;
  geometry.pickingColor = instancePickingColors;
  // uv = positions;

  vec2 iconSize = instanceIconFrames.zw;
  // convert size in meters to pixels, then scaled and clamp

  // project meters to pixels and clamp to limits
  float sizePixels = clamp(
    project_size_to_pixel(instanceSizes * sizeScale),
    sizeMinPixels, sizeMaxPixels
  );

  // scale icon height to match instanceSize
  float instanceScale = iconSize.y == 0.0 ? 0.0 : sizePixels / iconSize.y;

  // figure out angle
  vec3 point1 = project_position_to_clipspace(instanceStartPositions, vec3(0.0), vec3(0.0)).xyz;
  vec3 point2 = project_position_to_clipspace(instanceEndPositions, vec3(0.0), vec3(0.0)).xyz;
  vec3 direction = normalize(point2 - point1);
  float angle = atan( direction.y / direction.x);
  if (direction.x < 0.0) angle = angle - PI;

  // scale and rotate vertex in "pixel" value and convert back to fraction in clipspace
  vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffsets;
  pixelOffset = rotate_by_angle(pixelOffset, angle) * instanceScale;
  pixelOffset += instancePixelOffset;
  pixelOffset.y *= -1.0;

  // Calculate progress
  if (currentTime < instanceTimestamps) {
    vPercentComplete = -1.0;
  } else if (currentTime > instanceTimestampsNext) {
    vPercentComplete = -1.0;
  } else {
    vPercentComplete = (currentTime - instanceTimestamps) /
                       (instanceTimestampsNext - instanceTimestamps);
  }

  vec3 newPosition = interpolate(
    instanceStartPositions,
    instanceEndPositions,
    vPercentComplete);

  if (billboard)  {
    gl_Position = project_position_to_clipspace(newPosition, vec3(0.0), vec3(0.0));
    vec3 offset = vec3(pixelOffset, 0.0);
    DECKGL_FILTER_SIZE(offset, geometry);
    gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);

  } else {
    vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
    DECKGL_FILTER_SIZE(offset_common, geometry);
    gl_Position = project_position_to_clipspace(newPosition, offset_common, vec3(0.0));
  }

  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  vTextureCoords = mix(
    instanceIconFrames.xy,
    instanceIconFrames.xy + iconSize,
    (positions.xy + 1.0) / 2.0
  ) / iconsTextureDim;

  vColor = instanceColors;
  DECKGL_FILTER_COLOR(vColor, geometry);

  vColorMode = instanceColorModes;
}

from rest_framework import serializers


class SlideEventSerializer(serializers.Serializer):
    slide_index = serializers.IntegerField(min_value=0)
    at_ms = serializers.IntegerField(min_value=0)


class AttemptMetadataSerializer(serializers.Serializer):
    """Parse the JSON metadata part before accepting the separately uploaded audio."""

    id = serializers.UUIDField()
    deck_id = serializers.UUIDField()
    duration_ms = serializers.IntegerField(min_value=1)
    audience = serializers.CharField(max_length=500, allow_blank=True, default="")
    slide_events = SlideEventSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        events = attrs["slide_events"]
        if events[0]["at_ms"] != 0:
            raise serializers.ValidationError(
                "The initially visible slide must be logged at 0 ms."
            )
        times = [event["at_ms"] for event in events]
        if times != sorted(times) or times[-1] >= attrs["duration_ms"]:
            raise serializers.ValidationError(
                "Events must be ordered and occur before the audio ends."
            )
        # The upload handler must additionally check slide indexes against the persisted deck.
        return attrs

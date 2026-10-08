from rest_framework import serializers


class SlideEventSerializer(serializers.Serializer):
    slide_index = serializers.IntegerField(min_value=0)
    at_ms = serializers.IntegerField(min_value=0)


class AttemptMetadataSerializer(serializers.Serializer):
    """Parse the JSON metadata part before accepting the separately uploaded audio."""

    id = serializers.UUIDField()
    deck_id = serializers.UUIDField()
    duration_ms = serializers.IntegerField(min_value=1, max_value=600_000)
    audience = serializers.CharField(max_length=500, allow_blank=True, default="")
    slide_events = SlideEventSerializer(many=True, allow_empty=False, max_length=10_000)

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


class ProcessSerializer(serializers.Serializer):
    processing_revision = serializers.IntegerField(min_value=0, required=False)
    acknowledge_uncertain = serializers.BooleanField(required=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise serializers.ValidationError({'non_field_errors': ['Provide a JSON object with only processing_revision and acknowledge_uncertain.']})
        if 'processing_revision' in data and (type(data['processing_revision']) is not int or data['processing_revision'] < 0):
            raise serializers.ValidationError({'processing_revision': ['Must be a nonnegative integer.']})
        if 'acknowledge_uncertain' in data and type(data['acknowledge_uncertain']) is not bool:
            raise serializers.ValidationError({'acknowledge_uncertain': ['Must be a boolean.']})
        return super().to_internal_value(data)
